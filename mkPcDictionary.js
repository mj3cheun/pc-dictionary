var lodash = require('lodash');
var fs = require('fs');
var fsp = require('fs-promise');
var Entities = require('html-entities').AllHtmlEntities;
entities = new Entities();

console.log("Begin gmt file parsing ...");
console.log("");

/* All known datasources are as follows
[ 'HUMANCYC',
'ECOCYC',
'ARACYC',
'IOB',
'MSIGDB_C2',
'PATHWAY INTERACTION DATABASE NCI-NATURE CURATED DATA',
'NETPATH',
'PANTHER PATHWAY',
'REACTOME DATABASE ID RELEASE 59',
'REACTOME',
'GOBP' ]
Filter all datasources which are not accessible to Pathway Commons */
const removedDatasources = [
  'ECOCYC',
  'ARACYC',
  'IOB',
  'MSIGDB_C2',
  'NETPATH',
  'GOBP'
];

function datasourceFilter(datasourceString) {
  return removedDatasources.indexOf(datasourceString) === -1;
}

// Read gmt file to string
var fileString = fsp.readFile(__dirname + '/human-pathway-symbol.gmt', {
    encoding: 'utf8'
  })
  .then(text => {
    return text;
  });

// Parse gmt string to generate array containing all pathways and associated symbols and then filter all unused datasources
var pathway_array = fileString.then(text => {
  var pathwayArray = text.split(/\r\n|\r|\n/g)
    .filter((value) => {
      return value !== ""
    });

  return pathwayArray
    .map(pString => {
      return pString.split("\t");
    })
    .map(pArray => {
      var srcArray = pArray[0].split("%");
      return {
        name: entities.decode(pArray[1]).replace(/<[^>]+>/g, ""),
        datasource: srcArray[1],
        id: srcArray[2],
        data: pArray.slice(2, -1)
      };
    })
    .filter(pathwayObject => datasourceFilter(pathwayObject.datasource) && pathwayObject.name !== "untitled");
});

// Use pathway_array to generate object where the key are pathways
var pathway_object = pathway_array.then(pathwayArray => {
  var output = {};
  pathwayArray.map(pathwayObject => {
    if (output[pathwayObject.name] !== undefined) {
      console.log("WARNING: DUPLICATE PATHWAY " + pathwayObject.name);
    }
    output[pathwayObject.name] = lodash.omit(pathwayObject, "name");
  });
  return output;
});

// Use pathway_array to generate object where the key are symbols
var symbol_pathway_object = pathway_array.then(pathwayArray => {
  var output = {};
  pathwayArray.map(pathwayObject => {
    return pathwayObject.data.map(symbol => {
      if (output[symbol] === undefined) {
        output[symbol] = [];
      }
      output[symbol].push(lodash.omit(pathwayObject, "data"));
    });
  });
  return output;
});

// Use pathway_array to generate object where the key are datasources
var datasource_pathway_object = pathway_array.then(pathwayArray => {
  var output = {};
  pathwayArray.map(pathwayObject => {
    if (output[pathwayObject.datasource] === undefined) {
      output[pathwayObject.datasource] = [];
    }
    output[pathwayObject.datasource].push(lodash.omit(pathwayObject, "datasource"));
  });
  return output;
});

// Use symbol_pathway_object to generate enum object where the key are symbols
var symbol_enum = symbol_pathway_object.then(symbolObject => {
  var output = {};
  Object.keys(symbolObject).sort().map(symbol => {
    output[symbol] = 1;
  });
  return output;
});

// Use pathway_object to generate enum object where the key are pathways
var pathway_enum = pathway_object.then(pathwayObject => {
  var output = {};
  Object.keys(pathwayObject).sort().map(pathway => {
    output[pathway] = 1;
  });
  return output;
});

// Generate logged statistics
Promise.all([
  pathway_array,
  pathway_object,
  symbol_pathway_object,
  datasource_pathway_object,
  symbol_enum,
  pathway_enum
]).then(promiseArray => {
  console.log("");
  console.log("Processing completed")
  console.log(promiseArray[0].length + " pathway entries processed after filtering");
  console.log("Contains data from the following datasources: ");
  console.log(Object.keys(promiseArray[3]));
  console.log("Removed data from the following datasources: ");
  console.log(removedDatasources);
  console.log(Object.keys(promiseArray[4]).length + " symbols found");
  console.log(Object.keys(promiseArray[5]).length + " pathways found");
  console.log("");
});

function writeToFile(file_name, output) {
  var path = __dirname + "/output/" + file_name;
  try {
    fs.mkdirSync(__dirname + "/output");
  } catch (e) {}
  fsp.remove(path + ".min.json").then(() => {
    fsp.writeFile(path + ".min.json", JSON.stringify(output));
  });
  fsp.remove(path + ".json").then(() => {
    fsp.writeFile(path + ".json", JSON.stringify(output, null, 2));
  });
}

// Write pathway_array to file
pathway_array.then(output => {
  var file_name = "pathway_array";
  writeToFile(file_name, output);
});

// Write pathway_object to file
pathway_object.then(output => {
  var file_name = "pathway_object";
  writeToFile(file_name, output);
});

// Write symbol_pathway_object to file
symbol_pathway_object.then(output => {
  var file_name = "symbol_pathway";
  writeToFile(file_name, output);
});

// Write datasource_pathway_object to file
datasource_pathway_object.then(output => {
  var file_name = "datasource_pathway";
  writeToFile(file_name, output);
});

// Write symbol_enum to file
symbol_enum.then(output => {
  var file_name = "symbol_enum";
  writeToFile(file_name, output);
});

// Write symbol_enum to file
pathway_enum.then(output => {
  var file_name = "pathway_enum";
  writeToFile(file_name, output);
});

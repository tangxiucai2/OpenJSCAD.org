const { conversionFormats } = require('@jscad/core/io/formats')
const getFileExtensionFromString = require('../../utils/getFileExtensionFromString')

function flatten (array) {
  if (array === undefined || array === null) {
    return []
  }
  return [].concat(...array)
}

const readFileAsync = function (file, fileMeta) {
  const isBinaryFile = file.name.match(/\.(stl|gcode)$/) // FIXME how to determine?
  const reader = new FileReader()

  return new Promise(function (resolve, reject) {
    reader.readAsArrayBuffer(file)
    // remove rootfolder since all files are within it
    const fullPath = fileMeta && fileMeta.fullPath ? fileMeta.fullPath/*.split('/').slice(2).join('/')*/ : ''

    // convert binary to text
    function convert (buffer) {
      let binary = ''
      const bytes = new Uint8Array(buffer)
      let length = bytes.byteLength
      for (let i = 0; i < length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return binary
    }

    reader.onloadend = event => {
      event.target.readyState === FileReader.DONE
        ? resolve({name: file.name, ext: getFileExtensionFromString(fullPath), fullPath, source: convert(event.target.result)})
        : reject(new Error('Failed to load file'))
    }
  })
}

function isSupportedFormat (file) {
  var e = file.name.toLowerCase().match(/\.(\w+)$/i)
  e = RegExp.$1
  return conversionFormats.concat(['json']).indexOf(e) >= 0
}

function pseudoArraytoArray (pseudoArray) {
  let array = []
  for (var i = 0; i < pseudoArray.length; i++) {
    const item = pseudoArray[i]
    array.push(item.webkitGetAsEntry ? item.webkitGetAsEntry() : item)
  }
  return array
}

function processItems (items) {
  let results = pseudoArraytoArray(items)
    .filter(x => x !== null && x !== undefined)// skip empty items
    .reduce((result, item) => {
      // console.log('result', result, 'item', item)
      if (item.isFile) {
        result.push(processFile(item))
      } else if (item.isDirectory) {
        if (item.name !== '.git') { // ignore .git folder
          result.push(processDirectory(item))
        }
      } else if (item instanceof File) {
        const file = isSupportedFormat(item) ? readFileAsync(item, {fullPath: undefined}) : undefined
        if (!file) {
          throw new Error('Unsuported format (or folder in Safari)!')
        }
        result.push(file)
      }
      return result
    }, [])

  // const filesToIgnore()
  // .DS_Store, .git
  // console.warn(`ignoring Unsuported file ${fileData.name}`): this is for cases like .DSSTORE etc on mac
  return Promise.all(results)
    .then(x => x.filter(x => x !== null && x !== undefined))// .then(flatten)
    // .filter()
}

function processFile (fileItem) {
  return new Promise(function (resolve, reject) {
    fileItem.file(function (fileData) {
      isSupportedFormat(fileData) ? resolve(readFileAsync(fileData, fileItem)) : resolve(undefined)
    }, reject)
  })
}

function processDirectory (directory) {
  const reader = directory.createReader()
  return new Promise((resolve, reject) => {
    reader.readEntries(function (entries) {
      entries.length ? processItems(entries).then(resolve) : resolve(null)
    }, reject)
  })
  .then(flatten)
  .then(function (children) {
    children = children.map(child => {
      if (!child.fullPath.startsWith('/')) {
        //      // && !child.fullPath.startsWith('@')) {
        child.fullPath = directory.fullPath + '/' + child.name
        // return Object.assign({})
      }

      return child
    })
    return {children, fullPath: directory.fullPath, name: directory.name}
  })
}

// this is the core of the drag'n'drop:
//    1) walk the tree
//    2) read the files (readFileAsync)
//    3) return a flattened list of promises containing all file entries
function walkFileTree (items) {
  return processItems(items)
}

module.exports = {
  isSupportedFormat,
  pseudoArraytoArray,
  walkFileTree
}

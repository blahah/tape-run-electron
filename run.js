const {crashReporter, ipcMain, app, BrowserWindow} = require('electron')
var path = require('path')
var concat = require('concat-stream')

crashReporter.start({
  companyName: 'tape-run-electron'
})

app.on('ready', function () {
  var mainWindow = new BrowserWindow({show: false})
  mainWindow.loadUrl('file://' + path.join(__dirname, '/blank.html'))

  var finished = require('tap-finished')

  var p = finished(function (results) {
    mainWindow.send('close')
    process.exit(results.ok ? 0 : 1)
  })

  ipcMain.once('started', function () {
    process.stdin.pipe(concat(runTests))
  })

  function runTests (js) {
    mainWindow.webContents.executeJavaScript(
      "window.onerror = function(err) { console.log('Bail out! ' + err) }" +
      js.toString()
    )
  }

  ipcMain.on('log', function (e, data) {
    if (data) {
      console.log(data)
      if (data.match(/^Bail out!/)) {
        process.exit(1)
      }
      p.write(data + '\n')
    }
  })

  mainWindow.webContents.on('did-stop-loading', function load () {
    mainWindow.webContents.executeJavaScript(bootstrap())
  })

  function bootstrap () {
    return `
      const {ipcRenderer, crashReporter} = require('electron')
      crashReporter.start({
        companyName: 'tape-run-electron'
      })
      console.log = redirect
      process.browser = true
      global.module.paths.push('${process.cwd()}/node_modules')
      ipcRenderer.send('started')
      function redirect(text) {
        ipcRenderer.send('log', text)
      }
    `
  }
})

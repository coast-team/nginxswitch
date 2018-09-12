const fs = require('fs')
const { exec } = require('child_process')

const program = require('commander')
const jsonfile = require('jsonfile')
const prompt = require('prompt')

const packageJSON = jsonfile.readFileSync('./package.json')
const configJSON = jsonfile.readFileSync('./config.json')


function range (val) {
  return val.split(',')
}

function switchApp (appName) {
  const tmp = configJSON.dev[appName]
  configJSON.dev[appName] = configJSON.prod[appName]
  configJSON.prod[appName] = tmp
  console.info(appName + ' PROD becomes: ', configJSON.prod[appName])
  console.info(appName + ' DEV becomes: ', configJSON.dev[appName])
}


program
  .version(packageJSON.version)
  .command('switch <appNames...>')
  .alias('s')
  .description(`Switch between dev and prod for the specifed applications.
                      Supported app names: ${configJSON.apps}.
                      Examples:
                        '$ nginxswitch switch botStorage'
                        '$ nginxswitch switch signaling authProxy'
  `)
  .action((appNames) => {
    if (appNames.every((app) => configJSON.apps.includes(app))) {
      // Update config.json
      appNames.forEach(switchApp)
      jsonfile.writeFile('./config.json', configJSON)

      // Regenerate nginx conf file
      writeNginxConfFile()
      console.info(`${configJSON.nginxConfFile} file has been updated successfully`)

      // Reload Nginx
      reloadNginx()
      console.info('Nginx has been reloaded')
    } else {
      console.error('Unknown app names: ', appNames)
      console.info('Supported app names: ', configJSON.apps)
      process.exit(1)
    }
  })

program
  .command('getdev <appName>')
  .alias('g')
  .description(`Provide DEV path to the specified app.
                      Supported app names: ${configJSON.apps}.
  `)
  .action((appName) => {
    if (configJSON.apps.includes(appName)) {
      console.log(getAppPath(appName))
    } else {
      console.error('Unknown app name: ', appName)
      console.info('Supported app names: ', configJSON.apps)
      process.exit(1)
    }
  })
//
// program
//   .command('')
//   .description(`Show config file`)
//   .action((appName) => {
//     console.log(JSON.stringify(configJSON, null, 4))
//   })

program
  .command('init')
  .description('Initialize base options in config file')
  .action(() => {
      prompt.start()
      prompt.get({
        properties: {
        root: {
          message: 'Root path where A and B folder are located',
          required: true,
          default: '/root'
        },
        nginxConfFile: {
          message: 'Absolute path to the Nginx conf file which is generated each time the switch is performed',
          required: true
        }
      }
    }, (err, result) => {
      configJSON.root = result.root
      configJSON.nginxConfFile = result.nginxConfFile
      jsonfile.writeFile('./config.json', configJSON)
      console.log('Initialized successfully. Current config file is: ')
      prettyPrintConfigFile()
    })
  })

program.parse(process.argv)

// Init nginx conf file path
if (program.nginxConf !== undefined) {
  configJSON.nginxConfFile = program.nginxConf
  jsonfile.writeFile('./config.json', configJSON)
  console.info('Nginx conf file path is set to :', program.nginxConf)
}

function writeNginxConfFile () {
  const content =
`set $prod_localhost_port_signaling    ${configJSON.prod.signaling.port};
set $prod_localhost_port_bot_storage  ${configJSON.prod.botStorage.port};
set $prod_localhost_port_auth_proxy   ${configJSON.prod.authProxy.port};
set $prod_root_mute                   ${getAppPath('mute', false)};

set $dev_localhost_port_signaling     ${configJSON.dev.signaling.port};
set $dev_localhost_port_bot_storage   ${configJSON.dev.botStorage.port};
set $dev_localhost_port_auth_proxy    ${configJSON.dev.authProxy.port};
set $dev_root_mute                    ${getAppPath('mute')};
`
  fs.writeFileSync(configJSON.nginxConfFile, content)
}

function getAppPath (appName, isDev = true) {
  if (isDev) {
    return `${configJSON.root}/${configJSON.dev[appName].folder}/${appName}`
  } else {
    return `${configJSON.root}/${configJSON.prod[appName].folder}/${appName}`
  }
}

function reloadNginx () {
  exec('nginx -s reload', (err, stdout, stderr) => {
    if (err) {
      console.error('Failed to reload Nginx: ', err)
    } else {

    }
    console.log(stdout)
    console.log(stderr)
  })
}

function prettyPrintConfigFile () {
  console.log(JSON.stringify(configJSON, null, 4))
}

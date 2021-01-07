![Logo](admin/hyperion_ng.png)
# ioBroker.hyperion_ng

[![NPM version](http://img.shields.io/npm/v/iobroker.hyperion_ng.svg)](https://www.npmjs.com/package/iobroker.hyperion_ng)
[![Downloads](https://img.shields.io/npm/dm/iobroker.hyperion_ng.svg)](https://www.npmjs.com/package/iobroker.hyperion_ng)
![Number of Installations (latest)](http://iobroker.live/badges/hyperion_ng-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/hyperion_ng-stable.svg)
[![Dependency Status](https://img.shields.io/david/felixganzer/iobroker.hyperion_ng.svg)](https://david-dm.org/felixganzer/iobroker.hyperion_ng)
[![Known Vulnerabilities](https://snyk.io/test/github/felixganzer/ioBroker.hyperion_ng/badge.svg)](https://snyk.io/test/github/felixganzer/ioBroker.hyperion_ng)

[![NPM](https://nodei.co/npm/iobroker.hyperion_ng.png?downloads=true)](https://nodei.co/npm/iobroker.hyperion_ng/)

**Tests:** ![Test and Release](https://github.com/felixganzer/ioBroker.hyperion_ng/workflows/Test%20and%20Release/badge.svg)

## hyperion_ng adapter for ioBroker

With this adapter you can control your HyperionNG devices

## Manual

### General

The adapter will create for every hyperion hardware instance a folder with the instance number. Inside of these folder the actual adjustments, all components and all active priorities.

Additionally a general folder will be created which includes control, to send commands to hyperion, all possible effects and system informations about hyperion.

### control components and deactivate hyperion instance

You can control the components inside of the instance.components folder to set the boolean. After setting the parameter, all components parameter of the controlled instance and every following instances will be updated

Additionally you can set the instance.running parameter to activate and deactivate the whole instance

### control adjustments

you can control the adjustments inside of the instance.components folder to set the parameter. After setting the parameter, all adjustments of the controlled instance and every following instances will be updated

### set effects

To set an effect you have to set an instance number under general.control.instance. After that you can enter the correct name of an exisitng effect under general.control.setEffect. After setting the effect the priorities of the used instance and every following instances will be updated

Over general.control.durationEffectColor you can set a duration in seconds. You have to set these value before you set the effect. The standard value 0. This will set the effect time to infinity.

### set colors

To set a color you have to set an instance number under general.control.instance. After that you can enter a RGB value under general.control.setColorRGB. After setting the color the priorities of the used instance and every following instances will be updated

Over general.control.durationEffectColor you can set a duration in seconds. You have to set these value before you set the color. The standard value 0. This will set the effect time to infinity.

### clear effects and colors

To clear a priority you have to set an instance number under general.control.instance. After that you can set the parameter general.control.clearAll or general.control.clearVisible to true to clear priorities. After success the boolean will be set to false.





## Developer manual
This section is intended for the developer. It can be deleted later

### Best Practices
We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### Scripts in `package.json`
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `test:js` | Executes the tests you defined in `*.test.js` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:unit` | Tests the adapter startup with unit tests (fast, but might require module mocks to work). |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |

### Writing tests
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter
Since you have chosen GitHub Actions as your CI service, you can 
enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. The necessary steps are described in `.github/workflows/test-and-release.yml`.

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually on a local ioBroker installation
In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
    ```bash
    npm pack
    ```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
    ```bash
    cd /opt/iobroker
    npm i /path/to/tarball.tgz
    ```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.hyperion_ng`)
1. Execute `iobroker upload hyperion_ng` on the ioBroker host

## Changelog

### 0.1.8 (2021.01.07)
* (felixganzer) add set duration of effect and color to set
* (felixganzer) bugfix: clearVisible did not work

### 0.1.7 (2021.01.06)
* (felixganzer) bugfix: only works with iobroker adapter instance 0
* (felixganzer) updating the manual

### 0.1.6 (2021.01.03)
* (felixganzer) add setColorRGB under general.control
* (felixganzer) add controlling adjustments of hyperion
* (felixganzer) add start and stop Instance

### 0.1.5 (2021.01.02)
* (felixganzer) read out all possible effects
* (felixganzer) add setEffect under general.control
* (felixganzer) read out video Mode and LED Mapping
* (felixganzer) read out adjustments of instance

### 0.1.4 (2021.01.01)
* (felixganzer) add control clear of colors and effects

### 0.1.3 (2021.01.01)
* (felixganzer) add read out priorities to see actual running colors and effects

### 0.1.2 (2020.12.30)
* (felixganzer) add read out sysinfos to check Version of Hyperion

### 0.1.1 (2020.12.30)
* (felixganzer) add controlling components of hyperion
* (felixganzer) create first config to set IP, Port and Priority

### 0.1.0 (2020.12.29)
* (felixganzer) creating api class to communicate with hyperion and adding read out instances of hyperionNG

### 0.0.1 (2020.12.29)
* (felixganzer) initial release

## License
MIT License

Copyright (c) 2020 felixganzer <felixganzer@web.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
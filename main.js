'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const Hyperion_API = require('./hyperion_API');

var hyperion_API = null;
var adapter = null;
var numberOfInstances = 0;

/**
 * Validate a Hyperion response and return its info object.
 *
 * @param {Error|null} err callback error
 * @param {object|null} result Hyperion response
 * @param {string} expectedCommand expected Hyperion command
 * @param {string} context description used for logging
 * @returns {object|null} Hyperion info object or null
 */
function getHyperionInfo(err, result, expectedCommand, context) {
    if (err) {
        adapter.log.warn(`${context}: ${err.message || err}`);
        return null;
    }
    if (!result || typeof result !== 'object') {
        adapter.log.warn(`${context}: empty or invalid Hyperion response`);
        return null;
    }
    if (result.success === false) {
        adapter.log.warn(`${context}: ${result.error || 'Hyperion request failed'}`);
        return null;
    }
    if (expectedCommand && result.command !== expectedCommand) {
        adapter.log.warn(`${context}: unexpected command "${result.command || 'unknown'}", expected "${expectedCommand}"`);
        return null;
    }
    if (!result.info || typeof result.info !== 'object') {
        adapter.log.warn(`${context}: response contains no info object`);
        return null;
    }
    return result.info;
}

// Load your modules here, e.g.:
// const fs = require("node:fs");

class HyperionNg extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'hyperion_ng',
        });

        adapter = this; // set this Class as this adapter for using logging global;
        this.hyperionVersion = '1.9.0';

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * read out all system information from hyperion. set the version variable to check hyperion api Version
     * @param {() => void} callback
     */
    async readOutSystemInformations(callback) {
        hyperion_API.getSystemInfo(async (err, result) => {
            adapter.log.debug(JSON.stringify(result));
            try {
                const info = getHyperionInfo(err, result, 'sysinfo', 'Unable to read Hyperion system information');
                if (!info || !info.hyperion || !info.system) return;
                this.hyperionVersion = info.hyperion.version;
                let myobj = {type: 'folder', common: {name: 'general'}, native: {id: 'general'}};
                await adapter.setObjectNotExistsAsync('general', myobj);
                const my_hyperion = info.hyperion;
                myobj = {type: 'folder', common: {name: 'hyperion Info'}, native: {id: 'hyperion Info'}};
                await adapter.setObjectNotExistsAsync('general.hyperion', myobj);
                for (const hyperion in my_hyperion) {
                    const value = my_hyperion[hyperion];
                    myobj = {type: 'state', common: {role: hyperion, type: typeof value, name: hyperion}, native: {id: hyperion}};
                    await adapter.setObjectNotExistsAsync(`general.hyperion.${hyperion}`, myobj);
                    await adapter.setStateAsync(`general.hyperion.${hyperion}`, value, true);
                }
                const my_system = info.system;
                myobj = {type: 'folder', common: {name: 'System Info'}, native: {id: 'System Info'}};
                await adapter.setObjectNotExistsAsync('general.system', myobj);
                for (const system in my_system) {
                    const value = my_system[system];
                    myobj = {type: 'state', common: {role: system, type: typeof value, name: system}, native: {id: system}};
                    await adapter.setObjectNotExistsAsync(`general.system.${system}`, myobj);
                    await adapter.setStateAsync(`general.system.${system}`, value, true);
                }
            } catch (error) {
                adapter.log.error(`Error while processing Hyperion system information: ${error.stack || error}`);
            } finally {
                if (typeof callback === 'function') callback();
            }
        });
    }

    /**
     * read out all possible Effects from hyperion and save it under general effects
     * @param {() => void} callback
     */
    async readOutEffects(callback) {
        hyperion_API.getServerInfo(async (err, result) => {
            adapter.log.debug(JSON.stringify(result));
            try {
                const info = getHyperionInfo(err, result, 'serverinfo', 'Unable to read Hyperion effects');
                if (!info || !Array.isArray(info.effects)) return;
                const my_effects = info.effects;
                let my_effects_ID = -1;
                let myobj = {type: 'folder', common: {name: 'effects'}, native: {id: 'effects'}};
                await adapter.setObjectNotExistsAsync('general.effects', myobj);
                for (const effects in my_effects) {
                    my_effects_ID++;
                    const idString = ('00000' + my_effects_ID).slice(-2);
                    const effectName = `${idString}-${my_effects[effects].name}`;
                    myobj = {type: 'folder', common: {name: effectName}, native: {id: `effects${my_effects_ID}${effectName}`}};
                    await adapter.setObjectNotExistsAsync(`general.effects.${effectName}`, myobj);
                    const args = my_effects[effects].args || {};
                    for (const entry in args) {
                        let value = args[entry];
                        if (typeof value === 'string' || typeof value === 'object') value = JSON.stringify(value);
                        else if (typeof value === 'boolean') value = Boolean(value);
                        myobj = {type: 'state', common: {role: entry, type: typeof value, name: entry}, native: {id: entry}};
                        await adapter.setObjectNotExistsAsync(`general.effects.${effectName}.${entry}`, myobj);
                        await adapter.setStateAsync(`general.effects.${effectName}.${entry}`, value, true);
                    }
                }
            } catch (error) {
                adapter.log.error(`Error while processing Hyperion effects: ${error.stack || error}`);
            } finally {
                if (typeof callback === 'function') callback();
            }
        });
    }

    /**
     * support function for cleaning iobroker objects
     * @param {String}      objectPath search string for iobroker object ID
     * @param {() => void}  callback
     */
    deleteObjects(objectPath, callback){

        const self = this;
        // delete priorities of instance

        adapter.getStates(objectPath, function (err, obj_array) {

            for (const obj in obj_array)  {
                self.log.debug('Delete: ' + JSON.stringify(obj));
                self.delObjectAsync(obj);
            }

            setTimeout(function () {
                return callback();
            },self.config['communicationDelay']);
        });
    }


    /**
     * read out priorities (Quellenauswahl) of each instance and push information to iobroker
     * @param {() => void}  callback
     * @param {Integer}     instance integer of instance, which will be used. If not set, it will be 0 as default
     */
    readOutPriorities(callback, instance = 0) {
        const self = this;
        hyperion_API.getServerInfo(function(err, result) {
            adapter.log.debug(JSON.stringify(result));
            const info = getHyperionInfo(err, result, 'serverinfo', `Unable to read Hyperion priorities for instance ${instance}`);
            if (!info || !Array.isArray(info.priorities)) {
                return typeof callback === 'function' ? callback() : undefined;
            }
            self.deleteObjects(`${adapter.namespace}.${instance}.priorities*`, async function() {
                try {
                    const my_priorities = info.priorities;
                    let priorityID = -1;
                    let myobj = {type: 'folder', common: {name: 'priorities'}, native: {id: `${instance}priorities`}};
                    await adapter.setObjectNotExistsAsync(`${instance}.priorities`, myobj);
                    for (const priority of my_priorities) {
                        priorityID++;
                        const priorityName = `${priorityID}-${priority.componentId}`;
                        myobj = {type: 'folder', common: {name: priorityName}, native: {id: `${instance}priorities${priorityID}${priorityName}`}};
                        const objectPath = `${instance}.priorities.${priorityName}`;
                        await adapter.setObjectNotExistsAsync(objectPath, myobj);
                        for (const entry in priority) {
                            const value = priority[entry];
                            if (entry === 'value' && value && typeof value === 'object') {
                                for (const valueName in value) {
                                    const nestedValue = value[valueName];
                                    myobj = {type: 'state', common: {role: valueName, type: typeof nestedValue, name: valueName}, native: {id: valueName}};
                                    await adapter.setObjectNotExistsAsync(`${objectPath}.${valueName}`, myobj);
                                    await adapter.setStateAsync(`${objectPath}.${valueName}`, nestedValue, true);
                                }
                            } else {
                                myobj = {type: 'state', common: {role: entry, type: typeof value, name: entry}, native: {id: entry}};
                                await adapter.setObjectNotExistsAsync(`${objectPath}.${entry}`, myobj);
                                await adapter.setStateAsync(`${objectPath}.${entry}`, value, true);
                            }
                        }
                    }
                    const nextInstance = instance + 1;
                    if (nextInstance >= numberOfInstances) return callback();
                    self.readOutPriorities(callback, nextInstance);
                } catch (error) {
                    adapter.log.error(`Error while processing Hyperion priorities: ${error.stack || error}`);
                    if (typeof callback === 'function') callback();
                }
            });
        }, instance);
    }

    /**
     * read out number of instances, creates note at objects and set variable for number of existing instances
     * @param {() => void} callback
     */
    async readOutInstances(callback) {
        hyperion_API.getServerInfo(async function(err, result) {
            adapter.log.debug(JSON.stringify(result));
            try {
                const info = getHyperionInfo(err, result, 'serverinfo', 'Unable to read Hyperion instances');
                if (!info || !info.instance || typeof info.instance !== 'object') return;
                numberOfInstances = 0;
                for (const instance in info.instance) {
                    const currentInstance = info.instance[instance];
                    if (!currentInstance || typeof currentInstance !== 'object') continue;
                    const name = currentInstance.friendly_name || `Instance ${instance}`;
                    const running = currentInstance.running === true;
                    let myobj = {type: 'folder', common: {name}, native: {id: instance}};
                    await adapter.setObjectNotExistsAsync(instance.toString(), myobj);
                    myobj = {type: 'state', common: {role: 'indicator.reachable', type: 'boolean', read: true, write: true, name}, native: {id: instance}};
                    await adapter.setObjectNotExistsAsync(`${instance}.running`, myobj);
                    await adapter.setStateAsync(`${instance}.running`, running, true);
                    numberOfInstances++;
                }
            } catch (error) {
                adapter.log.error(`Error while processing Hyperion instances: ${error.stack || error}`);
            } finally {
                if (typeof callback === 'function') callback();
            }
        });
    }

    /**
     * read out compontent states of the instances
     * @param {() => void} callback
     * @param {Integer}     instance integer of instance, which will be used. If not set, it will be 0 as default
     */
    async readOutComponents(callback, instance = 0) {
        const self = this;
        hyperion_API.getServerInfo(async function(err, result) {
            adapter.log.debug(JSON.stringify(result));
            try {
                const info = getHyperionInfo(err, result, 'serverinfo', `Unable to read Hyperion components for instance ${instance}`);
                if (!info || !Array.isArray(info.components)) return;
                let myobj = {type: 'folder', common: {name: 'components', role: 'component parameter'}, native: {id: 'components'}};
                await adapter.setObjectNotExistsAsync(`${instance}.components`, myobj);
                for (const component of info.components) {
                    if (!component || typeof component !== 'object') continue;
                    const name = component.name;
                    if (!name) continue;
                    myobj = {type: 'state', common: {role: 'switch', type: 'boolean', read: true, write: true, name}, native: {id: `${instance}${name}`}};
                    await adapter.setObjectNotExistsAsync(`${instance}.components.${name}`, myobj);
                    await adapter.setStateAsync(`${instance}.components.${name}`, component.enabled === true, true);
                }
                if (info.videomode !== undefined) {
                    myobj = {type: 'state', common: {role: 'state', type: 'string', read: true, write: false, name: 'video mode'}, native: {id: `${instance}video mode`}};
                    await adapter.setObjectNotExistsAsync(`${instance}.video mode`, myobj);
                    await adapter.setStateAsync(`${instance}.video mode`, String(info.videomode), true);
                }
                if (info.imageToLedMappingType !== undefined) {
                    myobj = {type: 'state', common: {role: 'state', type: 'string', read: true, write: false, name: 'imageToLedMappingType'}, native: {id: `${instance}imageToLedMappingType`}};
                    await adapter.setObjectNotExistsAsync(`${instance}.imageToLedMappingType`, myobj);
                    await adapter.setStateAsync(`${instance}.imageToLedMappingType`, String(info.imageToLedMappingType), true);
                }
            } catch (error) {
                adapter.log.error(`Error while processing Hyperion components: ${error.stack || error}`);
            } finally {
                const nextInstance = instance + 1;
                if (nextInstance >= numberOfInstances) {
                    if (typeof callback === 'function') callback();
                } else {
                    self.readOutComponents(callback, nextInstance);
                }
            }
        }, instance);
    }

    /**
    * read out compontent states of the instances
    * @param {() => void} callback
    * @param {Integer}     instance integer of instance, which will be used. If not set, it will be 0 as default
    */

    async readOutAdjustments(callback, instance = 0) {
        const self = this;
        hyperion_API.getServerInfo(async function(err, result) {
            adapter.log.debug(JSON.stringify(result));
            try {
                const info = getHyperionInfo(err, result, 'serverinfo', `Unable to read Hyperion adjustments for instance ${instance}`);
                if (!info || !Array.isArray(info.adjustment) || !info.adjustment[0]) return;
                let myobj = {type: 'folder', common: {name: 'adjustments', role: 'adjustment parameter'}, native: {id: 'adjustments'}};
                await adapter.setObjectNotExistsAsync(`${instance}.adjustments`, myobj);
                const adjustment = info.adjustment[0];
                for (const entry in adjustment) {
                    const value = adjustment[entry];
                    myobj = {type: 'state', common: {role: entry, type: typeof value, name: entry}, native: {id: entry}};
                    await adapter.setObjectNotExistsAsync(`${instance}.adjustments.${entry}`, myobj);
                    await adapter.setStateAsync(`${instance}.adjustments.${entry}`, value, true);
                }
            } catch (error) {
                adapter.log.error(`Error while processing Hyperion adjustments: ${error.stack || error}`);
            } finally {
                const nextInstance = instance + 1;
                if (nextInstance >= numberOfInstances) {
                    if (typeof callback === 'function') callback();
                } else {
                    self.readOutAdjustments(callback, nextInstance);
                }
            }
        }, instance);
    }

    /**
     * create Iobroker Objects to set different Parameter to Hyperion
     */
    async createControlParameter() {

        this.log.info('create Control Parameter');

        // Object to set the instance for the control area
        await this.setObjectNotExistsAsync('general.control.instance', {
            type: 'state',
            common: {
                name: 'control instance',
                type: 'number',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.instance', { val: 0, ack: true });

        // Object to clear all effects and colors
        await this.setObjectNotExistsAsync('general.control.clearAll', {
            type: 'state',
            common: {
                name: 'clear all priorities',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.clearAll', { val: false, ack: true });

        // Object to clear visible effects and colors
        await this.setObjectNotExistsAsync('general.control.clearVisible', {
            type: 'state',
            common: {
                name: 'clear visible priority',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.clearVisible', { val: false, ack: true });

        // Object to set effect
        await this.setObjectNotExistsAsync('general.control.setEffect', {
            type: 'state',
            common: {
                name: 'set Effect over String',
                type: 'string',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.setEffect', { val: '', ack: true });

        // Object to set effect or color duration
        await this.setObjectNotExistsAsync('general.control.durationEffectColor', {
            type: 'state',
            common: {
                name: 'set time of Effect or Color in seconds',
                type: 'number',
                role: 'level.timer',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.durationEffectColor', { val: 0, ack: true });

        // Object to set color
        await this.setObjectNotExistsAsync('general.control.setColorRGB', {
            type: 'state',
            common: {
                name: 'set Color over RGB',
                type: 'string',
                role: 'level.color.rgb',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.setColorRGB', { val: '50,100,150', ack: true });

        adapter.log.info(this.RGBToHSL('50,100,150'));

        // Object to set color HSL
        await this.setObjectNotExistsAsync('general.control.setColorHSL_H', {
            type: 'state',
            common: {
                name: 'set Color over HSL',
                type: 'number',
                role: 'level.color.hue',
                read: true,
                write: true,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('general.control.setColorHSL_S', {
            type: 'state',
            common: {
                name: 'set Color over HSL',
                type: 'number',
                role: 'level.color.saturation',
                read: true,
                write: true,
            },
            native: {},
        });

        await this.setObjectNotExistsAsync('general.control.setColorHSL_L', {
            type: 'state',
            common: {
                name: 'set Color over HSL',
                type: 'number',
                role: 'level.color.luminance',
                read: true,
                write: true,
            },
            native: {},
        });

        await this.updateHSLDataPoints(this.RGBToHSL('50,100,150'));

        // Object to updateAdapter
        await this.setObjectNotExistsAsync('general.control.updateAdapter', {
            type: 'state',
            common: {
                name: 'update all Datapoints',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.updateAdapter', { val: false, ack: true });

        // Object to updatePriorities
        await this.setObjectNotExistsAsync('general.control.updatePriorities', {
            type: 'state',
            common: {
                name: 'update all Priorities',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.updatePriorities', { val: false, ack: true });

        // Object to setGrabberVisible
        await this.setObjectNotExistsAsync('general.control.setInternalGrabberVisible', {
            type: 'state',
            common: {
                name: 'set Internal Grabber Visible',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.setInternalGrabberVisible', { val: false, ack: true });

        // Object to setGrabberVisible
        await this.setObjectNotExistsAsync('general.control.setUSBGrabberVisible', {
            type: 'state',
            common: {
                name: 'set USB Grabber Visible',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.setUSBGrabberVisible', { val: false, ack: true });

    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {

        hyperion_API = new Hyperion_API.Hyperion_API(this, this.config['address'], this.config['json_port'], this.config['prio'], this.config['connectionTimeout'], this.config['communicationDelay']);

        await this.createControlParameter();

        this.readOutSystemInformations( () => {

            if(this.hyperionVersion.substr(0,1) != '2' || parseInt(this.hyperionVersion.substr(0,2)) >= 16) {
                this.log.error('Your Version of hyperion (' + this.hyperionVersion + ') is not supported!!');
                return;
            }

            this.readOutInstances( () => {
                this.readOutComponents((err, result) => {
                    this.readOutAdjustments((err, result) => {
                        this.readOutPriorities((err, result) => {
                            this.readOutEffects((err, result) => {
                                this.log.info('setup finished');
                                this.subscribeStates('*');
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            if (hyperion_API != null){
                hyperion_API.clearSocket();

                setTimeout(function () {
                    return callback();
                },hyperion_API.getCommunicationTimeout());
            }
            else{
                return callback();
            }
        } catch (e) {
            callback();
        }
    }

    /**
     * Convert RGB value into HSL value
     * @param {String}      colorRGB    RGB values of Color
     */
    RGBToHSL(colorRGB) {

        var colorArrayString = colorRGB.split(',');
        var r = parseInt(colorArrayString[0]);
        var g = parseInt(colorArrayString[1]);
        var b = parseInt(colorArrayString[2]);

        // Make r, g, and b fractions of 1
        r /= 255;
        g /= 255;
        b /= 255;
        
        // Find greatest and smallest channel values
        let cmin = Math.min(r,g,b),
            cmax = Math.max(r,g,b),
            delta = cmax - cmin,
            h = 0,
            s = 0,
            l = 0;
        // Calculate hue
        // No difference
        if (delta == 0)
        h = 0;
        // Red is max
        else if (cmax == r)
        h = ((g - b) / delta) % 6;
        // Green is max
        else if (cmax == g)
        h = (b - r) / delta + 2;
        // Blue is max
        else
        h = (r - g) / delta + 4;

        h = Math.round(h * 60);
        
        // Make negative hues positive behind 360°
        if (h < 0)
            h += 360;
        // Calculate lightness
        l = (cmax + cmin) / 2;

        // Calculate saturation
        s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
            
        // Multiply l and s by 100
        // s = +(s * 100).toFixed(1);
        // l = +(l * 100).toFixed(1);

        return h + "," + s + "," + l;
    }

    /**
     * Convert HSL value into RGB value
     * @param {number}      h    H value of HSL
     * @param {number}      s    S value of HSL
     * @param {number}      l    L value of HSL
     */
    HSLToRGB(h,s,l) {

        let c = (1 - Math.abs(2 * l - 1)) * s,
            x = c * (1 - Math.abs((h / 60) % 2 - 1)),
            m = l - c/2,
            r = 0,
            g = 0,
            b = 0;

        if (0 <= h && h < 60) {
            r = c; g = x; b = 0;  
        } else if (60 <= h && h < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
            r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
            r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
            r = x; g = 0; b = c;
        } else if (300 <= h && h < 360) {
            r = c; g = 0; b = x;
        }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
    
        return r + "," + g + "," + b;
            
    }

    /**
     * Set HSL Datapoints of Adapter
     * @param {String}      colorHSL    RGB values of Color
     */
    async updateHSLDataPoints(colorHSL)
    {
        const colorArrayString = colorHSL.split(',');
        const h = Number(colorArrayString[0]);
        const s = Number(parseFloat(colorArrayString[1]).toFixed(2));
        const l = Number(parseFloat(colorArrayString[2]).toFixed(2));

        await this.setStateAsync('general.control.setColorHSL_H', { val: h, ack: true });
        await this.setStateAsync('general.control.setColorHSL_S', { val: s, ack: true });
        await this.setStateAsync('general.control.setColorHSL_L', { val: l, ack: true });
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

            if (!state.ack) {
                const id_arr = id.split('.');

                // #####################  set Components #####################################

                if (id_arr[3] === 'components') {
                    hyperion_API.setComponentStatus(id_arr[4], state.val, id_arr[2], (err, result) => {
                        this.readOutComponents((err, result) => {
                            this.log.info('component is set');
                        },parseInt(id_arr[2]));
                    });
                }

                // #####################  set Adjustment #####################################

                if (id_arr[3] === 'adjustments') {
                    hyperion_API.setAdjustment(id_arr[4], state.val, id_arr[2], (err, result) => {
                        this.readOutAdjustments((err, result) => {
                            this.log.info('Adjustment is set');
                        },parseInt(id_arr[2]));
                    });
                }

                // #####################  clear all priorities ##############################

                if (id_arr[3] === 'control' && id_arr[4] === 'clearAll') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        hyperion_API.clearPriority(-1, instance.val, (err, result) => {
                            this.setState(id,{ val: false, ack: true });
                            this.readOutPriorities((err, result) => {});

                        });
                    });
                }

                // #####################  clear visible priorities ###########################

                if (id_arr[3] === 'control' && id_arr[4] === 'clearVisible') {
                    this.getState(this.namespace + '.general.control.instance', (err, instance) => {
                        this.getStates(this.namespace + '.' + instance.val + '.priorities.0*', (err, obj_array) => {
                            for (const obj in obj_array)  {
                                const obj_string = JSON.stringify(obj);
                                if (obj_string.includes('priority')) {
                                    hyperion_API.clearPriority(obj_array[obj].val, instance.val, (err, result) => {
                                        this.setState(id,{ val: false, ack: true });
                                        this.readOutPriorities((err, result) => {});
                                    });
                                }
                            }
                        });
                    });
                }

                // #####################  set Effect ####################################

                if (id_arr[3] === 'control' && id_arr[4] === 'setEffect') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        this.getState(this.namespace + '.general.control.durationEffectColor',(err, effectDuration) => {
                            if (effectDuration.val == 0) {
                                hyperion_API.setEffect(instance.val, state.val, (err, result) => {
                                    setTimeout(() =>{
                                        this.setState(id,{ val: '', ack: true });
                                        this.readOutPriorities((err, result) => {});
                                    },this.config['communicationDelay']);
                                });
                            }
                            else {
                                hyperion_API.setEffectDuration(instance.val, state.val, effectDuration.val * 1000, (err, result) => {
                                    setTimeout(() =>{
                                        this.setState(id,{ val: '', ack: true });
                                        this.setState(effectDuration,{ val: 0, ack: true });
                                        this.readOutPriorities((err, result) => {});
                                    },this.config['communicationDelay']);
                                });
                            }
                        });
                    });
                }

                // #####################  set Color RGB ####################################

                if (id_arr[3] === 'control' && id_arr[4] === 'setColorRGB') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        this.getState(this.namespace + '.general.control.durationEffectColor',(err, colorDuration) => {
                            if (colorDuration.val == 0) {
                                hyperion_API.setColorRGB(instance.val, state.val, (err, result) => {
                                    setTimeout(() =>{
                                        this.setState(id,{ val: state.val, ack: true });
                                        this.updateHSLDataPoints(this.RGBToHSL(state.val));
                                        this.readOutPriorities((err, result) => {});
                                    },this.config['communicationDelay']);
                                });
                            }
                            else {
                                hyperion_API.setColorRGBDuration(instance.val, state.val, colorDuration.val * 1000, (err, result) => {
                                    setTimeout(() =>{
                                        this.setState(id,{ val: state.val, ack: true });
                                        this.updateHSLDataPoints(this.RGBToHSL(state.val));
                                        this.setState(colorDuration,{ val: 0, ack: true });
                                        this.readOutPriorities((err, result) => {});
                                    },this.config['communicationDelay']);
                                });
                            }
                        });
                    });
                }

                // #####################  set Color HSL #####################################

                if (id_arr[3] === 'control' && (id_arr[4] === 'setColorHSL_H'|| id_arr[4] === 'setColorHSL_S'|| id_arr[4] === 'setColorHSL_L')){
                    this.getState(this.namespace + '.general.control.setColorHSL_H',(err, h) => {
                        this.getState(this.namespace + '.general.control.setColorHSL_S',(err, s) => {
                            this.getState(this.namespace + '.general.control.setColorHSL_L',(err, l) => {
                                const colorRGB = this.HSLToRGB(h.val,s.val,l.val);
                                this.setState(id,{ val: state.val, ack: true });
                                this.setState(this.namespace + '.general.control.setColorRGB',{ val: colorRGB, ack: false });
                            });
                        });
                    });
                }

                // #####################  check instance of existing instance ###############

                if (id_arr[3] === 'control' && id_arr[4] === 'instance') {
                    if(state.val < numberOfInstances) {
                        this.setState(id,{ val: state.val, ack: true });
                    } else {
                        this.setState(id,{ val: 0, ack: true });
                        adapter.log.error('Die gesetzte Instance existiert nicht und wird auf null zuückgesetzt.')
                    }
                }

                // #####################  start and stop intance ###############

                if (id_arr[3] === 'running') {
                    hyperion_API.startStopInstance(state.val, id_arr[2], (err, result) => {
                        this.readOutInstances((err, result) => {
                            this.log.info('Instance running status is changed');
                        });
                    });
                }

                // #####################  update whole Adapter ###############

                if (id_arr[3] === 'control' && id_arr[4] === 'updateAdapter') {
                    this.readOutInstances((err, result) => {
                        this.readOutComponents((err, result) => {
                            this.readOutAdjustments((err, result) => {
                                this.readOutPriorities((err, result) => {
                                    this.readOutEffects((err, result) => {
                                        this.setState(id,{ val: false, ack: true });
                                        this.log.info('Updated whole Adapter Parameter');
                                        this.subscribeStates('*');
                                    });
                                });
                            });
                        });
                    });
                }

                // #####################  update Priorities ###############

                if (id_arr[3] === 'control' && id_arr[4] === 'updatePriorities') {
                    this.readOutPriorities((err, result) => {
                        this.setState(id,{ val: false, ack: true });
                        this.log.info('Updated Priorities');
                    });
                }

                // #####################  set internal Grabber Visible ###############

                if (id_arr[3] === 'control' && id_arr[4] === 'setInternalGrabberVisible') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        hyperion_API.setGrabberVisible(this.config['prioInternalGrabber'], instance.val, (err, result) => {
                            this.readOutPriorities((err, result) => {
                                this.setState(id,{ val: false, ack: true });
                                this.log.info('set Internal Grabber Visible');
                            });
                        });
                    });
                }

                // #####################  set USB Grabber Visible ###############

                if (id_arr[3] === 'control' && id_arr[4] === 'setUSBGrabberVisible') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        hyperion_API.setGrabberVisible(this.config['prioUSBGrabber'], instance.val, (err, result) => {
                            this.readOutPriorities((err, result) => {
                                this.setState(id,{ val: false, ack: true });
                                this.log.info('set USB Grabber Visible');
                            });
                        });
                    });
                }
            }
        } else {
            // The state was deleted
            this.log.debug(`state ${id} deleted`);
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new HyperionNg(options);
} else {
    // otherwise start the instance directly
    new HyperionNg();
}
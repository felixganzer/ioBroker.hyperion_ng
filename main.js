'use strict';

/*
 * Created with @iobroker/create-adapter v1.31.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const Hyperion_API = require('./hyperion_API');

var hyperion_API;
var adapter = null;
var numberOfInstances = 0;

// Load your modules here, e.g.:
// const fs = require("fs");

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

        hyperion_API.getSystemInfo((err, result) => {
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'sysinfo') {

                //hyperion set Version
                this.hyperionVersion = result.info.hyperion.version;
                
                var myobj = {type: 'folder',common: {name: 'general'}, native:{id: 'general'}};
                    adapter.setObject('general', myobj);

                //hyperion Info
                var my_hyperion = result.info.hyperion;
                var myobj = {type: 'folder',common: {name: 'hyperion Info'}, native:{id: 'hyperion Info'}};
                adapter.setObject('general.hyperion', myobj);
                
                for (var hyperion in my_hyperion){
                    var my_arg_Name = hyperion;
                    var my_arg_val = my_hyperion[hyperion];

                    myobj = {type: 'state', common: {role: my_arg_Name, type: typeof(my_arg_val), name: my_arg_Name}, native:{id: my_arg_Name}};
                    adapter.setObject('general.hyperion.' + my_arg_Name, myobj);
                    adapter.setState('general.hyperion.' + my_arg_Name, my_arg_val, true);
                }
                
                //System Info
                var my_system = result.info.system;
                myobj = {type: 'folder',common: {name: 'System Info'}, native:{id: 'System Info'}};
                adapter.setObject('general.system', myobj);

                for (var system in my_system){
                    var my_arg_Name = system;
                    var my_arg_val = my_system[system];

                    myobj = {type: 'state', common: {role: my_arg_Name, type: typeof(my_arg_val), name: my_arg_Name}, native:{id: my_arg_Name}};
                    adapter.setObject('general.system.' + my_arg_Name, myobj);
                    adapter.setState('general.system.' + my_arg_Name, my_arg_val, true);
                }
            }
            else {
                adapter.log.error('Error at read out SystemInformations');
            }

            return callback();
        });
    }

    /**
     * read out all possible Effects from hyperion and save it under general effects
     * @param {() => void} callback
     */
    async readOutEffects(callback) {

        hyperion_API.getServerInfo((err, result) => {
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'serverinfo') {

                // create priority folder at instance
                var my_effects       = result.info.effects;
                var my_effects_ID    = -1;

                var myobj = {type: 'folder',common: {name: 'effects'}, native:{id: 'effects'}};
                adapter.setObject('general.effects', myobj);
                
                adapter.log.info('create effects');

                // create priority at priority folder
                for (var effects in my_effects){
            
                    my_effects_ID++;
                    var my_effects_ID_string = ("00000" + my_effects_ID).slice(-2);
                    var my_effects_Name =  my_effects_ID_string + '-' + my_effects[effects].name;

                    myobj = {type: 'folder', common: {name: my_effects_Name}, native:{id: 'effects'+ my_effects_ID + my_effects_Name}};
                    adapter.setObject('general.effects' + '.' + my_effects_Name, myobj);

                    var object_array = my_effects[effects].args;
                    var object_path = 'general.effects' + '.' + my_effects_Name;

                    // fill priority with parameter
                    for (var entry in object_array){
                        var entry_Name = entry;
                        var entry_val = object_array[entry];

                        myobj = {type: 'state', common: {role: entry_Name, type: typeof(entry_val), name: entry_Name}, native:{id: entry_Name}};
                        adapter.setObject(object_path + '.' + entry_Name, myobj);
                        adapter.setState(object_path + '.' + entry_Name, entry_val, true);
                    }
                } 
            }
            else {
                adapter.log.error('Error at read out SystemInformations');
            }

            return callback();
        });
    }

    /**
     * support function for cleaning iobroker objects
     * @param {String}      objectPath search string for iobroker object ID
     * @param {() => void}  callback
     * 
     */
    deleteObjects(objectPath, callback){
        
        const self = this;
        // delete priorities of instance

        adapter.getStates(objectPath, function (err, obj_array) {
                    
            for (var obj in obj_array)  { 
            self.log.debug("Delete: " + JSON.stringify(obj));
            self.delObjectAsync(obj);
            }

            setTimeout(function () {
                return callback();
            },100);
        });
    }
    
    
    /**
     * read out priorities (Quellenauswahl) of each instance and push information to iobroker
     * @param {() => void}  callback
     * @param {Integer}     instance integer of instance, which will be used. If not set, it will be 0 as default
     */
    readOutPriorities(callback, instance = 0) {

        const self = this;
        
        hyperion_API.getServerInfo(function(err, result){
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'serverinfo') {

                self.deleteObjects('hyperion_ng.0.' + instance + '.priorities*',function(err, result2){ 
                            
                    // create priority folder at instance
                    var my_priorities       = result.info.priorities;
                    var my_priorities_ID    = -1;

                    var myobj = {type: 'folder',common: {name: 'priorities'}, native:{id: instance + 'priorities'}};
                    adapter.setObject(instance + '.' + 'priorities', myobj);
                    
                    adapter.log.info('create priorities');

                    // create priority at priority folder
                    for (var priorities in my_priorities){
                
                        my_priorities_ID++;
                        var my_priorities_Name =  my_priorities_ID + '-' + my_priorities[priorities].componentId;

                        myobj = {type: 'folder',common: {name: my_priorities_Name}, native:{id: instance + 'priorities'+ my_priorities_ID + my_priorities_Name}};
                        adapter.setObject(instance + '.' + 'priorities' + '.' + my_priorities_Name, myobj);

                        var object_array = my_priorities[priorities];
                        var object_path = instance + '.' + 'priorities' + '.' + my_priorities_Name;

                        // fill priority with parameter
                        for (var entry in object_array){
                            var entry_Name = entry;
                            var entry_val = object_array[entry];

                            myobj = {type: 'state', common: {role: entry_Name, type: typeof(entry_val), name: entry_Name}, native:{id: entry_Name}};
                            adapter.setObject(object_path + '.' + entry_Name, myobj);
                            adapter.setState(object_path + '.' + entry_Name, entry_val, true);
                        }
                    } 

                    instance++;

                    if (instance >= numberOfInstances) {
                        adapter.log.info("read out priorities finished");
                    return callback();
                    }
        
                    self.readOutPriorities(callback, instance);
                },);   
            }
            else {
                adapter.log.error('Error at read out priorities');
            }

        }, instance);
    }

    /**
     * read out number of instances, creates note at objects and set variable for number of existing instances
     * @param {() => void} callback
     */
    async readOutInstances(callback) {

        hyperion_API.getServerInfo(function(err, result){
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'serverinfo') {

                var my_instances = result.info.instance;

                numberOfInstances = 0;
                for (var instance in my_instances){
                
                    var my_instance_ID = instance;
                    var my_instance_Name = my_instances[instance].friendly_name;
                    var my_instance_running = my_instances[instance].running;

                    var myobj = {type: 'folder',common: {name: my_instance_Name}, native:{id: my_instance_Name}};
                    adapter.setObject(my_instance_ID.toString(), myobj);

                    myobj = {type: 'state', common: {role: 'running status', type: 'boolean', name: my_instance_Name}, native:{id: my_instance_ID + my_instance_Name}};
                    adapter.setObject(my_instance_ID + '.' + 'running', myobj);
                    adapter.setState(my_instance_ID + '.' + 'running', my_instance_running, true);
                    
                    numberOfInstances++;
                }
            }
            else {
                adapter.log.error('Error at read out instances');
            }

            return callback();
        });
    }

    /**
     * read out compontent states of the instances
     * @param {() => void} callback
     * @param {Integer}     instance integer of instance, which will be used. If not set, it will be 0 as default
     */
    async readOutComponents(callback, instance = 0) {

        const self = this;

        hyperion_API.getServerInfo(function(err, result){
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'serverinfo') {

                var my_components = result.info.components;
                for (var component in my_components){
                
                    var my_component_Name   = my_components[component].name;
                    var my_component_status = my_components[component].enabled;

                    var myobj ={
                        type: 'folder',
                        common: {
                            name: 'components',
                            role: 'component paramter',
                        },
                        native: {id: 'components'},
                    }

                    adapter.setObject(instance + '.' + 'components', myobj);

                    myobj = {type: 'state', common: {role: 'set component status', type: 'boolean', name: my_component_Name}, native:{id: instance + my_component_Name}};

                    adapter.setObject(instance + '.' + 'components' + '.' + my_component_Name, myobj);
                    adapter.setState(instance + '.' + 'components' + '.' + my_component_Name, my_component_status, true);
                }

                // read out video mode
                var my_videoMode = result.info.videomode;
                myobj = {type: 'state', common: {role: 'video mode', type: 'string', name: 'video mode'}, native:{id: instance + 'video mode'}};

                adapter.setObject(instance + '.' + 'video mode', myobj);
                adapter.setState(instance + '.' + 'video mode', my_videoMode, true);

                // read out LED Mapping
                var my_imageToLedMappingType = result.info.imageToLedMappingType;
                myobj = {type: 'state', common: {role: 'imageToLedMappingType', type: 'string', name: 'imageToLedMappingType'}, native:{id: instance + 'imageToLedMappingType'}};

                adapter.setObject(instance + '.' + 'imageToLedMappingType', myobj);
                adapter.setState(instance + '.' + 'imageToLedMappingType', my_imageToLedMappingType, true);

                instance++;
            }
            else {
                adapter.log.error('Error at read out components');
            }

            if (instance >= numberOfInstances) {
                adapter.log.info("read out components finished");
            return callback();
            }

            self.readOutComponents(callback, instance);

        }, instance);
    }

     /**
     * read out compontent states of the instances
     * @param {() => void} callback
     * @param {Integer}     instance integer of instance, which will be used. If not set, it will be 0 as default
     */
    async readOutAdjustments(callback, instance = 0) {

        const self = this;

        hyperion_API.getServerInfo(function(err, result){
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'serverinfo') {
                
                var myobj ={
                    type: 'folder',
                    common: {
                        name: 'adjustments',
                        role: 'adjustment paramter',
                    },
                    native: {id: 'adjustments'},
                }

                adapter.setObject(instance + '.' + 'adjustments', myobj);

                var object_array = result.info.adjustment[0];
                var object_path = instance + '.' + 'adjustments';

                adapter.log.debug(JSON.stringify(result.info.adjustment));

                // fill priority with parameter
                for (var entry in object_array){
                    var entry_Name = entry;
                    var entry_val = object_array[entry];

                    myobj = {type: 'state', common: {role: entry_Name, type: typeof(entry_val), name: entry_Name}, native:{id: entry_Name}};
                    adapter.setObject(object_path + '.' + entry_Name, myobj);
                    adapter.setState(object_path + '.' + entry_Name, entry_val, true);
                }

                instance++;
            }
            else {
                adapter.log.error('Error at read out Adjustments');
            }

            if (instance >= numberOfInstances) {
                adapter.log.info("read out Adjustments finished");
            return callback();
            }

            self.readOutAdjustments(callback, instance);

        }, instance);
    }

    /**
     * create Iobroker Objects to set different Parameter to Hyperion
     */
    async createControlParameter() {

        this.log.info("create Control Parameter");

        // Object to set the instance for the control area
        await this.setObjectNotExistsAsync('general.control.instance', {
            type: 'state',
            common: {
                name: 'control instance',
                type: 'number',
                role: 'control.state',
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
                role: 'control.state',
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
                role: 'control.state',
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
                role: 'control.state',
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
                role: 'control.state',
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
                role: 'control.state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.setColorRGB', { val: '255,255,255', ack: true });

        // Object to updateAdapter
        await this.setObjectNotExistsAsync('general.control.updateAdapter', {
            type: 'state',
            common: {
                name: 'update all Datapoints',
                type: 'boolean',
                role: 'control.state',
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
                role: 'control.state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.updatePriorities', { val: false, ack: true });

        // Object to setGrabberVisible
        await this.setObjectNotExistsAsync('general.control.setGrabberVisible', {
            type: 'state',
            common: {
                name: 'set Grabber Visible',
                type: 'boolean',
                role: 'control.state',
                read: true,
                write: true,
            },
            native: {},
        });
        await this.setStateAsync('general.control.setGrabberVisible', { val: false, ack: true });

    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {

        hyperion_API = new Hyperion_API.Hyperion_API(this, this.config['address'], this.config['json_port'], this.config['prio']);

        await this.createControlParameter();

        this.readOutSystemInformations( () => {

            if(this.hyperionVersion.substr(0,1) != "2") {
                this.log.error("Your Version of hyperion (" + this.hyperionVersion + ') is not supported!!');
                return;
            }

            this.readOutInstances( () => {
                this.readOutComponents((err, result) => {
                    this.readOutAdjustments((err, result) => {
                        this.readOutPriorities((err, result) => {
                            this.readOutEffects((err, result) => {
                                this.log.info("setup finished");
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
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
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
                var id_arr = id.split('.');

                // #####################  set Components #####################################
                
                if (id_arr[3] === 'components') {
                    hyperion_API.setComponentStatus(id_arr[4], state.val, id_arr[2], (err, result) => {
                        this.readOutComponents((err, result) => {
                            this.log.info("component is set");
                        },parseInt(id_arr[2]));
                    });
                }

                // #####################  set Adjustment #####################################
                
                if (id_arr[3] === 'adjustments') {
                    hyperion_API.setAdjustment(id_arr[4], state.val, id_arr[2], (err, result) => {
                        this.readOutAdjustments((err, result) => {
                            this.log.info("Adjustment is set");
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
                            for (var obj in obj_array)  { 
                                var obj_string = JSON.stringify(obj);
                                if (obj_string.includes("priority")) {
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
                            if (effectDuration == 0) {
                                hyperion_API.setEffect(instance.val, state.val, (err, result) => {
                                    setTimeout(() =>{
                                    this.setState(id,{ val: '', ack: true });
                                    this.readOutPriorities((err, result) => {});
                                    },200);
                                });
                            }
                            else {
                                hyperion_API.setEffectDuration(instance.val, state.val, effectDuration.val * 1000, (err, result) => {
                                    setTimeout(() =>{
                                    this.setState(id,{ val: '', ack: true });
                                    this.setState(effectDuration,{ val: 0, ack: true });
                                    this.readOutPriorities((err, result) => {});
                                    },200);
                                });
                            }
                        });
                    });
                }

                // #####################  set Color RGB ####################################

                if (id_arr[3] === 'control' && id_arr[4] === 'setColorRGB') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        this.getState(this.namespace + '.general.control.durationEffectColor',(err, colorDuration) => {
                            if (colorDuration == 0) {
                                hyperion_API.setColorRGB(instance.val, state.val, (err, result) => {
                                    setTimeout(() =>{
                                    this.setState(id,{ val: '255,255,255', ack: true });
                                    this.readOutPriorities((err, result) => {});
                                    },200);
                                });
                            }
                            else {
                                hyperion_API.setColorRGBDuration(instance.val, state.val, colorDuration.val * 1000, (err, result) => {
                                    setTimeout(() =>{
                                    this.setState(id,{ val: '255,255,255', ack: true });
                                    this.setState(colorDuration,{ val: 0, ack: true });
                                    this.readOutPriorities((err, result) => {});
                                    },200);
                                });
                            }
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
                            this.log.info("Instance running status is changed");
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
                                        this.log.info("Updated whole Adapter Parameter");
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
                        this.log.info("Updated Priorities");
                    });         
                }

                // #####################  set Grabber Visible ###############

                if (id_arr[3] === 'control' && id_arr[4] === 'setGrabberVisible') {
                    this.getState(this.namespace + '.general.control.instance',(err, instance) => {
                        hyperion_API.setGrabberVisible(instance.val, (err, result) => {
                            this.readOutPriorities((err, result) => {
                                this.setState(id,{ val: false, ack: true });
                                this.log.info("set Grabber Visible");
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
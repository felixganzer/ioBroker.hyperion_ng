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
                
                var myobj = {type: 'instance independent parameter',common: {name: 'general'}, native:{id: 'general'}};
                    adapter.setObject('general', myobj);

                //hyperion Info
                var my_hyperion = result.info.hyperion;
                var myobj = {type: 'hyperion Info',common: {name: 'hyperion Info'}, native:{id: 'hyperion Info'}};
                adapter.setObject('general.hyperion', myobj);
                
                for (var hyperion in my_hyperion){
                    var my_arg_Name = hyperion;
                    var my_arg_val = my_hyperion[hyperion];

                    myobj = {type: 'state', common: {role: my_arg_Name, type: 'state', name: my_arg_Name}, native:{id: my_arg_Name}};
                    adapter.setObject('general.hyperion.' + my_arg_Name, myobj);
                    adapter.setState('general.hyperion.' + my_arg_Name, my_arg_val, true);
                }
                
                //System Info
                var my_system = result.info.system;
                myobj = {type: 'System Info',common: {name: 'System Info'}, native:{id: 'System Info'}};
                adapter.setObject('general.system', myobj);

                for (var system in my_system){
                    var my_arg_Name = system;
                    var my_arg_val = my_system[system];

                    myobj = {type: 'state', common: {role: my_arg_Name, type: 'state', name: my_arg_Name}, native:{id: my_arg_Name}};
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

    deleteObjects(objectPath, callback){
        
        const self = this;
        // delete priorities of instance

        adapter.getStates(objectPath, function (err, obj_array) {
                    
            for (var obj in obj_array)  { 
            self.log.error("Test: " + JSON.stringify(obj));
            self.delObjectAsync(obj);
            }

            setTimeout(function () {
                return callback();
            },100);
        });
    }
    
    
    /**
     * read out priorities (Quellenauswahl) of each instance and push information to iobroker
     * @param {() => void} callback
     */
    async readOutPriorities(callback, instance = 0) {

        const self = this;
        
        hyperion_API.getServerInfo(function(err, result){
            adapter.log.debug(JSON.stringify(result));
            if( err == null && result.command == 'serverinfo') {

                self.deleteObjects('hyperion_ng.0.' + instance + '.priorities*',function(err, result2){ 
                            
                    // create priority folder at instance
                    var my_priorities       = result.info.priorities;
                    var my_priorities_ID    = -1;

                    var myobj = {type: 'priorities',common: {name: 'priorities'}, native:{id: instance + 'priorities'}};
                    adapter.setObject(instance + '.' + 'priorities', myobj);
                    
                    adapter.log.info('create priorities');

                    // create priority at priority folder
                    for (var priorities in my_priorities){
                
                        my_priorities_ID++;
                        var my_priorities_Name =  my_priorities_ID + '-' + my_priorities[priorities].componentId;

                        myobj = myobj = {type: my_priorities_Name,common: {name: my_priorities_Name}, native:{id: instance + 'priorities'+ my_priorities_ID + my_priorities_Name}};
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

                    var myobj = {type: 'Instance_ID',common: {name: my_instance_Name}, native:{id: my_instance_Name}};
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
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
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

                    var myobj = {type: 'components',common: {name: 'components'}, native:{id: 'components'}};
                    adapter.setObject(instance + '.' + 'components', myobj);

                    myobj = {type: 'state', common: {role: 'set component status', type: 'boolean', name: my_component_Name}, native:{id: instance + my_component_Name}};
                    adapter.setObject(instance + '.' + 'components' + '.' + my_component_Name, myobj);
                    adapter.setState(instance + '.' + 'components' + '.' + my_component_Name, my_component_status, true);
                }

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
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {

        hyperion_API = new Hyperion_API.Hyperion_API(this, this.config['address'], this.config['json_port'], this.config['prio']);

        this.readOutSystemInformations( () => {

            if(this.hyperionVersion.substr(0,1) != "2") {
                this.log.error("Your Version of hyperiion (" + this.hyperionVersion + ') is not supported!!');
                return;
            }

            this.readOutInstances( () => {
                this.readOutComponents((err, result) => {
                    this.readOutPriorities((err, result) => {
                        this.log.info("setup finished");
                        this.subscribeStates('*');
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

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

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
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

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
"use strict";

var net = require('net');
var adapterMain = null;
var callbackFns = [];

class Hyperion_API
{
    constructor(adapter, host_IP = '127.0.0.1', host_Port = 19444, priority = 50, timeout = 1){

        this.host_IP    = host_IP;
        this.host_Port  = host_Port;
        this.priority 	= priority;
        this.timeout    = timeout; // in Minuten
        this.socket     = null;
        adapterMain     = adapter;

        this.connected  = false;
        this.databuffer = '';
    }

    /**
     * This method parses incoming data, and fires the corresponding callback
     *
     * @param {string} data			data string
     */
    parseData(data){
        this.databuffer += data;
        adapterMain.log.debug('databuffer: ' + this.databuffer);
        if( this.databuffer.indexOf("\n") > -1 ) {
            this.databuffer.split("\n").forEach(function(response, i){
                adapterMain.log.debug('response string: ' + response);

                // not sure why this happens, dual \n
                if( response.length == 0 ) return;
                
                try {
                    response = [ null, JSON.parse(response) ];
                } catch(e){
                    response = [ e, null ];
                }
                            
                var callbackFn = callbackFns.shift();
                if( typeof callbackFn == 'function' ) {
                    adapterMain.log.debug('response JSON: ' + JSON.stringify(response));
                    callbackFn.apply(null, response);
                }
            }.bind(this));   
        }
    }

    /**
     * This method parses incoming data, and fires the corresponding callback
     *
     * @param {string} data			data string
     */
    async connectSocket(callback) {
        
        const self = this;

        if (this.socket && !this.connected) {
            this.socket.destroy(); // kill client after server's response
        }

        this.socket = new net.Socket();

        await this.socket.connect(this.host_Port, this.host_IP, function() {
            this.connected = true;
            adapterMain.log.info('socket is connected');
        }.bind(this));

        this.socket.setTimeout(60000 * this.timeout);

        this.socket.setEncoding('utf8');

        this.socket.on('data', function(data) {
            adapterMain.log.debug('data: ' + data);
            this.parseData(data);
        }.bind(this));

        this.socket.on('timeout', () => {
            console.log('socket timeout');
            if (this.socket) {this.socket.end();};
          });
        
        this.socket.on('close', function() {
            adapterMain.log.info('Connection closed');
            this.connected = false;
        }.bind(this));
    }

    /**
     * This method check connection to socket and reconnect if neccessary, and fires the corresponding callback
     *
     * @param {Function} callback	callback function, using (err, result)
     */
    async checkConnection(callback) {

        if (this.connected == false) {
            
            await this.connectSocket(function(){});
            adapterMain.log.debug('socket reconnected');

            return callback;
        }

        adapterMain.log.debug('socket skip reconnecting');
    }

    /**
     * Send a message
     *
     * @param {object} message		can be anything, but an invalid object might crasg hyperion
     * @param {Function} callback	callback function, using (err, result)
     */
    async sendMessage(message, callback){

        await this.checkConnection(function(){});

        if (this.socket){

            if (this.socket.writable){

                message = JSON.stringify(message);
                this.socket.write(message + "\n");
                adapterMain.log.debug('message sent: ' + message);
                callbackFns.push(callback);
            } else {
                callback( new Error("not connected"), null );
            }
        }
    }
    
    /**
     * Get server information, if you use more than one LED-Hardware instance it is necessary to set at first
     * the instance ID. The response of this communication will be trown away.
     *
     * @param {Function} callback	callback function, using (err, result)
     * @param {integer} instance    hyperion instance number to get informations for the correct one
     */
    async getServerInfo(callback, instance= 0) {
        adapterMain.log.debug('get components of instance ' + instance);

        const self = this;

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : parseInt(instance)
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command : 'serverinfo'
                }, callback);
            },50) ;
        });
    }

    /**
     * Get system information, an information about the instance is not nesessary
     * the instance ID. The response of this communication will be trown away.
     *
     * @param {Function} callback	callback function, using (err, result)
     */
    async getSystemInfo(callback) {
        adapterMain.log.debug('get System Information');

        this.sendMessage({
                    command : 'sysinfo'
                }, callback);
    }

    /**
     * set Component Status, an information about the instance is nesessary
     *
     * @param {String}      component	name of component to have change
     * @param {boolean}     state	    state of component to have set
     * @param {integer}     instance    hyperion instance number to get informations for the correct one
     * @param {Function}    callback	callback function, using (err, result)
     */
    async setComponentStatus(component, state, instance, callback) {
        adapterMain.log.info('set component ' + component + ' of instance ' + instance + ' to ' + state);

        const self = this;

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : parseInt(instance)
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'componentstate',
                    componentstate  : {
                    component       : component,
                    state           : state
                    }
                }, callback);
            },50) ;
        });
    }

    /**
     * set Adjustment, an information about the instance is nesessary
     *
     * @param {String}      adjustment	name of component to have change
     * @param {String}      state	    state could be several different types, depents of Adjustment
     * @param {integer}     instance    hyperion instance number to get informations for the correct one
     * @param {Function}    callback	callback function, using (err, result)
     */
    async setAdjustment(adjustment, state, instance, callback) {
        adapterMain.log.info('set Adjustment ' + adjustment + ' of instance ' + instance + ' to ' + state);

        var Type = require('type-of-is');
        const self = this;

        if (Type.is(state, String)) {
            var colorArray = [255,255,255];
            var colorArrayString = state.split(',');
            colorArray[0] = parseInt(colorArrayString[0]);
            colorArray[1] = parseInt(colorArrayString[1]);
            colorArray[2] = parseInt(colorArrayString[2]);
        }

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : parseInt(instance)
        },function(){
            self.databuffer = '';
            switch(adjustment){
            case "backlightColored": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { backlightColored      : Boolean(state)}}, callback);},100) ;
                break;
            case "backlightThreshold": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { backlightThreshold    : parseInt(state)}}, callback);},100) ;
                break;
            case "blue": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { blue                  : colorArray}}, callback);},100) ;
                break;
            case "brightness": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { brightness            : parseInt(state)}}, callback);},100) ;
                break;
            case "brightnessCompensation": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { brightnessCompensation: parseInt(state)}}, callback);},100) ;
                break;
            case "cyan": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { cyan                  : colorArray}}, callback);},100) ;
                break;
            case "gammaBlue": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { gammaBlue             : parseFloat(state)}}, callback);},100) ;
                break;
            case "gammaGreen": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { gammaGreen            : parseFloat(state)}}, callback);},100) ;
                break;
            case "gammaRed": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { bgammaRed             : parseFloat(state)}}, callback);},100) ;
                break;
            case "green": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { green                 : colorArray}}, callback);},100) ;
                break;
            case "id": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { id                    : state}}, callback);},100) ;
                break;
            case "magenta": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { magenta               : colorArray}}, callback);},100) ;
                break;
            case "red": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { red                   : colorArray}}, callback);},100) ;
                break;
            case "white": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { white                 : colorArray}}, callback);},100) ;
                break;
            case "yellow": 
                setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { yellow                : colorArray}}, callback);},100) ;
                break;
            }
        });
    }

    /**
     * Get server information, if you use more than one LED-Hardware instance it is necessary to set at first
     * the instance ID. The response of this communication will be trown away.
     *
     * @param {number}      priority    
     * @param {number}      instance    hyperion instance number to get informations for the correct one
     * @param {Function}    callback	callback function, using (err, result)
     */
    async clearPriority(priority, instance, callback) {
        
        if (priority == -1 ){
            adapterMain.log.info('clear all priorities of instance ' + instance);
        }else {
            adapterMain.log.info('clear priority with the number ' + priority + ' of instance ' + instance);
        }

        const self = this;

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'clear',
                    priority       : priority
                }, callback);
            },50) ;
        });
    }

    /**
     * Set Effect over effect Name. It will be used the priority of the adapter
     *  
     * @param {number}      instance        hyperion instance number to get informations for the correct one
     * @param {String}      effectName      name of effect which will be set
     * @param {Function}    callback	    callback function, using (err, result)
     */
    async setEffect(instance, effectName, callback) {
        
        const self = this;

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'effect',
                    effect          : {
                        name        : effectName,
                    },
                    priority        : self.priority,
                    origin          : 'ioBroker'
                }, callback);
            },50) ;
        });
    }

    /**
     * Set Effect over effect Name. It will be used the priority of the adapter
     *  
     * @param {number}      instance        hyperion instance number to get informations for the correct one
     * @param {String}      effectName      name of effect which will be set
     * @param {number}      effectDuration  time of effect duration in ms
     * @param {Function}    callback	    callback function, using (err, result)
     */
    async setEffectDuration(instance, effectName, effectDuration, callback) {
        
        const self = this;

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'effect',
                    effect          : {
                        name        : effectName,
                    },
                    duration        : effectDuration,
                    priority        : self.priority,
                    origin          : 'ioBroker'
                }, callback);
            },50) ;
        });
    }

    /**
     * Set Color over RGB seperated with comma. It will be used the priority of the adapter
     *  
     * @param {number}      instance    hyperion instance number to get informations for the correct one
     * @param {String}      colorRGB    RGB values of Color
     * @param {Function}    callback	callback function, using (err, result)
     */
    async setColorRGB(instance, colorRGB, callback) {
        
        const self = this;

        var colorArray = [255,255,255];
        var colorArrayString = colorRGB.split(',');
        colorArray[0] = parseInt(colorArrayString[0]);
        colorArray[1] = parseInt(colorArrayString[1]);
        colorArray[2] = parseInt(colorArrayString[2]);

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'color',
                    color           : colorArray,
                    priority        : self.priority,
                    origin          : 'ioBroker'
                }, callback);
            },50) ;
        });
    }

    /**
     * Set Color over RGB seperated with comma. It will be used the priority of the adapter
     *  
     * @param {number}      instance        hyperion instance number to get informations for the correct one
     * @param {String}      colorRGB        RGB values of Color
     * @param {number}      colorDuration   time of effect duration in ms
     * @param {Function}    callback	    callback function, using (err, result)
     */
    async setColorRGBDuration(instance, colorRGB, colorDuration, callback) {
        
        const self = this;

        var colorArray = [255,255,255];
        var colorArrayString = colorRGB.split(',');
        colorArray[0] = parseInt(colorArrayString[0]);
        colorArray[1] = parseInt(colorArrayString[1]);
        colorArray[2] = parseInt(colorArrayString[2]);

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'color',
                    color           : colorArray,
                    duration        : colorDuration,
                    priority        : self.priority,
                    origin          : 'ioBroker'
                }, callback);
            },50) ;
        });
    }

    /**
     * Start and Stop Instance
     *  
     * @param {String}      instance    hyperion instance number to get informations for the correct one
     * @param {Boolean}     state       activate and deactivate Instance
     * @param {Function}    callback	callback function, using (err, result)
     */
    async startStopInstance(state, instance, callback) {
        
        if(state) {
            this.databuffer = '';
            this.sendMessage({
                command     : "instance",
                subcommand  : "startInstance",
                instance    : parseInt(instance)
            },callback);
        }else {
            this.databuffer = '';
            this.sendMessage({
                command     : "instance",
                subcommand  : "stopInstance",
                instance    : parseInt(instance)
            },callback);
        }
    }

    /**
     * Set Grabber as visible Priority. At Standard the Priority will be 250
     * @param {number}      priority  
     * @param {number}      instance        hyperion instance number to get informations for the correct one
     * @param {Function}    callback	    callback function, using (err, result)
     */
    async setGrabberVisible(priority, instance, callback) {
        
        const self = this;

        self.sendMessage({
            command     : "instance",
            subcommand  : "switchTo",
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'sourceselect',
                    priority        : priority,
                }, callback);
            },50) ;
        });
    }
}

module.exports.Hyperion_API = Hyperion_API;
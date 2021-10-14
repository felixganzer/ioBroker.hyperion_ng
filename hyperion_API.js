"use strict";

var net = require('net');
var adapterMain = null;
var callbackFns = [];

class Hyperion_API
{
    constructor(adapter, host_IP = '127.0.0.1', host_Port = 19444, priority = 50, timeout = 1, communicationDelay = 50){

        this.host_IP    = host_IP;
        this.host_Port  = host_Port;
        this.priority 	= priority;
        this.timeout    = timeout; // in Minuten
        this.communicationDelay = communicationDelay;
        this.socket     = null;
        adapterMain     = adapter;

        this.connected  = false;
        this.databuffer = '';
        this.communicationTimer = null;
        this.communicationTimeOut = 0;
    }

    /**
     * This method set an timer for communication delay of Hyperion communication
     *
     * @param {number} time			time in milli seconds
     */
    setCommunicationTimer(time)
    {
        if (this.communicationTimer)
        { 
            clearTimeout(this.communicationTimer);
            this.communicationTimeOut = 0;
            adapterMain.log.debug('clear Timer');
        }
        
        this.communicationTimer = setTimeout(()=>{
            this.clearCommunicationTimer();
        }, time);
        adapterMain.log.debug('set Timer to ' + time + ' ms');
        this.communicationTimeOut = time;
    }

    /**
     * This method clear communication Timer for shutDown
     *
     */
    clearCommunicationTimer()
    {
        if (this.communicationTimer)
        { 
            clearTimeout(this.communicationTimer);
            this.communicationTimer = null;
            this.communicationTimeOut = 0;
            adapterMain.log.debug('clear Timer regulary');
        }
    }

    /**
     * This method callback the last communication timeout time
     *
     */
    getCommunicationTimeout()
    {
        adapterMain.log.debug('get Timer of ' + this.communicationTimeOut + ' ms');
        return this.communicationTimeOut;
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
     * This method clears socket
     *
     */
    clearSocket(){
        
        if (this.socket) {
            this.socket.destroy(); // kill client after server's response
        }
    }

    /**
     * This method parses incoming data, and fires the corresponding callback
     *
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

        this.socket.on('error', function(ex) {
            adapterMain.log.error("handled socket error");
            adapterMain.log.error(ex);
          }.bind(this));

        this.socket.on('data', function(data) {
            adapterMain.log.debug('data: ' + data);
            this.parseData(data);
        }.bind(this));

        this.socket.on('timeout', () => {
            adapterMain.log.info('socket timeout');
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
     * @param {string}   instance    hyperion instance number to get informations for the correct one
     */
    async getServerInfo(callback, instance= '0') {
        adapterMain.log.debug('get components of instance ' + instance);

        const self = this;

        self.sendMessage({
            command     : 'instance',
            subcommand  : 'switchTo',
            instance    : parseInt(instance)
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command : 'serverinfo'
                }, callback);
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
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
     * @param {String}      instance    hyperion instance number to get informations for the correct one
     * @param {Function}    callback	callback function, using (err, result)
     */
    async setComponentStatus(component, state, instance, callback) {
        adapterMain.log.info('set component ' + component + ' of instance ' + instance + ' to ' + state);

        const self = this;

        self.sendMessage({
            command     : 'instance',
            subcommand  : 'switchTo',
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
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
        });
    }

    /**
     * set Adjustment, an information about the instance is nesessary
     *
     * @param {String}      adjustment	name of component to have change
     * @param {String}      state	    state could be several different types, depents of Adjustment
     * @param {String}      instance    hyperion instance number to get informations for the correct one
     * @param {Function}    callback	callback function, using (err, result)
     */
    async setAdjustment(adjustment, state, instance, callback) {
        adapterMain.log.info('set Adjustment ' + adjustment + ' of instance ' + instance + ' to ' + state);

        const Type = require('type-of-is');
        const self = this;

        if (Type.is(state, String)) {
            var colorArray = [255,255,255];
            const colorArrayString = state.split(',');
            colorArray[0] = parseInt(colorArrayString[0]);
            colorArray[1] = parseInt(colorArrayString[1]);
            colorArray[2] = parseInt(colorArrayString[2]);
        }

        self.sendMessage({
            command     : 'instance',
            subcommand  : 'switchTo',
            instance    : parseInt(instance)
        },function(){
            self.databuffer = '';
            switch(adjustment){
                case 'backlightColored':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { backlightColored      : Boolean(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'backlightThreshold':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { backlightThreshold    : parseInt(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'blue':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { blue                  : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'brightness':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { brightness            : parseInt(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'brightnessCompensation':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { brightnessCompensation: parseInt(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'cyan':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { cyan                  : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'gammaBlue':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { gammaBlue             : parseFloat(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'gammaGreen':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { gammaGreen            : parseFloat(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'gammaRed':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { bgammaRed             : parseFloat(state)}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'green':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { green                 : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'id':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { id                    : state}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'magenta':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { magenta               : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'red':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { red                   : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'white':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { white                 : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
                    break;
                case 'yellow':
                    setTimeout(function () {self.sendMessage({ command : 'adjustment', adjustment : { yellow                : colorArray}}, callback);},self.communicationDelay);self.setCommunicationTimer(self.communicationDelay);
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
            command     : 'instance',
            subcommand  : 'switchTo',
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'clear',
                    priority       : priority
                }, callback);
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
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
            command     : 'instance',
            subcommand  : 'switchTo',
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
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
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
            command     : 'instance',
            subcommand  : 'switchTo',
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
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
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

        try {
            colorArray[0] = parseInt(colorArrayString[0]);
            colorArray[1] = parseInt(colorArrayString[1]);
            colorArray[2] = parseInt(colorArrayString[2]);
        }catch(err){
            
            adapterMain.log.error('RGB color is wrong')
            colorArray = [255,255,255];
        }

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
            },50);
            self.setCommunicationTimer(50);
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

        let colorArray = [255,255,255];
        const colorArrayString = colorRGB.split(',');

        try {
            colorArray[0] = parseInt(colorArrayString[0]);
            colorArray[1] = parseInt(colorArrayString[1]);
            colorArray[2] = parseInt(colorArrayString[2]);
        }catch(err){

            adapterMain.log.error('RGB color is wrong');
            colorArray = [255,255,255];
        }

        self.sendMessage({
            command     : 'instance',
            subcommand  : 'switchTo',
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
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
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
                command     : 'instance',
                subcommand  : 'startInstance',
                instance    : parseInt(instance)
            },callback);
        }else {
            this.databuffer = '';
            this.sendMessage({
                command     : 'instance',
                subcommand  : 'stopInstance',
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
            command     : 'instance',
            subcommand  : 'switchTo',
            instance    : instance
        },function(){
            self.databuffer = '';
            setTimeout(function () {
                self.sendMessage({
                    command         : 'sourceselect',
                    priority        : priority,
                }, callback);
            },self.communicationDelay);
            self.setCommunicationTimer(self.communicationDelay);
        });
    }
}

module.exports.Hyperion_API = Hyperion_API;
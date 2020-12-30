"use strict";

var net = require('net');
var adapterMain = null;
var callbackFns = [];

class Hyperion_API
{
    constructor(host_IP, host_Port, adapter){

        this.host_IP    = host_IP;
        this.host_Port  = host_Port;
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

        await this.socket.connect(19444, '192.168.178.45', function() {
            this.connected = true;
            adapterMain.log.info('socket is connected');
        }.bind(this));

        this.socket.setTimeout(30000);

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
     * Get server information, if you use more than one LED-Hardware instance it is necessary to set at first
     * the instance ID. The response of this communication will be trown away.
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
}

module.exports.Hyperion_API = Hyperion_API;
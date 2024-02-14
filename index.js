/**
 * @fileoverview This is the main file which stars a child process
 */

const fs = require('fs');
const { spawn, exec } = require('child_process');
const ws = require('ws');

let randomWebsocketPort =  Math.floor(Math.random() * 1000) + 9000;

let dataFromLocalFile = null;

try {
    dataFromLocalFile = fs.readFileSync('.roboport', 'utf8');
}
catch (e) {}


randomWebsocketPort = dataFromLocalFile ? JSON.parse(dataFromLocalFile).port : randomWebsocketPort;
console.log("Started a websocket server on port: ", randomWebsocketPort);

// write the port to a file
fs.writeFileSync('.roboport',JSON.stringify( {
    port: randomWebsocketPort,
    arguments: process.argv
}));

const listOfClients = [];

// Start a websocket server and write the port to a file
const wss = new ws.Server({ port: randomWebsocketPort });
wss.on('connection', (ws) => {
    listOfClients.push(ws);
    ws.send(JSON.stringify({
        type: 'connected'
    }))
    ws.on('message', (message) => {

    });
    ws.on('close', () => {
        console.log('Client disconnected');
        listOfClients.splice(listOfClients.indexOf(ws), 1);
    });
});

wss.on('close', () => {
    console.log('Websocket server closed');
});



const current_args = process.argv.slice(2);
const child = exec(current_args.join(" "), {
   stdio: "pipe"
})
child.stdout.on('data', (data) => {
    listOfClients.forEach(client => {
        client.send(JSON.stringify({
            type: 'stdout',
            data: data.toString()
        }));
    });
});
child.stderr.on('data', (data) => {
    listOfClients.forEach(client => {
        client.send(JSON.stringify({
            type: 'stderr',
            data: data.toString()
        }));
    });
});
child.on('close', (code) => {
    listOfClients.forEach(client => {
        client.send(JSON.stringify({
            type: 'close',
            data: code
        }));
    });
    console.log(`child process exited with code ${code}`);
    process.exit(code);
});



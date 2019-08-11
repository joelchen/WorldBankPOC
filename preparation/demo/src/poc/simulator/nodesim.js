const IPFS = require('ipfs')
const Room = require('ipfs-pubsub-room')
const PeerId = require('peer-id');
const {demoPeerKeys} = require('../demoPeerIdKeys');
const roomMessageHandler = require('./roomMeesageHandler');
const townHall = require('./townHall');
const taskRoom = require('./taskRoom');
const blockRoom = require('./blockRoom');

function main(){
  //const peer = await PeerId.createFromJSON(demoPeerKeys[0]);
  window.IPFS = IPFS;
  console.log('before IPFS.create');
  IPFS.create({
    repo: 'ipfs-leo/poc/' + Math.random(),
    EXPERIMENTAL: {
      pubsub: true
    },
    // init:{
    //   privateKey:peer
    // },
    config: {
      Addresses: {
        Swarm: [
          '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
        ]
      }
    }
  }).then((ipfs)=>{
    console.log('IPFS node is ready');
    console.log("taskroom", taskRoom, townHall);
    window.ipfs = ipfs;
    ipfs.on('error', error=>{
      console.log('IPFS on error:', error);
    });
  
    ipfs.on('init', error=>{
      console.log('IPFS on init:', error);
    });
    // async function store () {
    //   const toStore = document.getElementById('source').value
  
    //   const res = await node.add(Buffer.from(toStore))
  
    //   res.forEach((file) => {
    //     if (file && file.hash) {
    //       console.log('successfully stored', file.hash)
    //       display(file.hash)
    //     }
    //   })
    // }
  
    // async function display (hash) {
    //   // buffer: true results in the returned result being a buffer rather than a stream
    //   const data = await node.cat(hash)
    //   document.getElementById('hash').innerText = hash
    //   document.getElementById('content').innerText = data
    // }
  
    // document.getElementById('store').onclick = store
    console.log("taskroom", taskRoom, townHall);
    roomMessageHandler(ipfs, 'taskRoom', taskRoom);
    roomMessageHandler(ipfs, 'townHall', townHall);
    window.blockRoom = roomMessageHandler(ipfs, 'blockRoom', blockRoom);
  });
  

};


document.addEventListener('DOMContentLoaded', main);
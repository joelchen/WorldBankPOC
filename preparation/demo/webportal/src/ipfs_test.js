const MyIpfs = require('../../src/shared/MyIpfs');
const IPFS = require('ipfs');
const PeerId = require('peer-id');
const EChart = require('./echart');
const Data = require('./data');
import {tryParseJson} from '../../src/poc/constValue';

let _n = 1;
const log = (str)=>{
  str = `[${_n}] => `+str;
  const html = MyIpfs.log(str);
  $('.js_html').prepend(html);
  _n++;
}

const C = {
  blockRoom : 'blockRoom',
  taskRoom : 'taskRoom',
  townHall : 'townHall',
  user : null
};

let myIpfs = null;
let myChart = null;
let myData = null;
let blockRoom, taskRoom, townHall;
const F = {
  loading(f=false){
    if(f){
      $.fakeLoader({
        timeToHide : 999999,
        bgColor : 'rgba(0,0,0,0.7)'
      });
    }
    else{
      $('.fakeLoader').hide();
    }
  },
  async init(){
    const params = util.getUrlParam();
    C.user = {
      name : params.u,
      pub : params.pub,
      pri : params.pri
    };
    C.blockRoom = 'blockRoom'+params.r;
    C.taskRoom = 'taskRoom'+params.r;
    C.townHall = 'townHall'+params.r;

    myIpfs = new MyIpfs();
    myChart = new EChart($('#echart-div')[0], {
      user: C.user,
      click(d){
        if(!d) return false;
        
        const el = $('#js_node_detail');
        el.data('json', d).modal('show');
        _.delay(()=>{
          el.find('.js_title').html('Peer : '+ d.name);
          el.find('.js_score').html(d.creditScore);
          el.find('.js_gas').html(d.gas);
          el.find('.js_geo').html(d.location.join(' - '));
          el.find('.js_ipfs').html(d.ipfs_id);

          if(d.peerId !== C.user.name){
            el.find('.js_me').hide();
            el.find('.js_other').show();
          }
          else{
            el.find('.js_me').show();
            el.find('.js_other').hide();
          }
        }, 100);
      }
    });
    myData = new Data(myIpfs);
    window.myData = myData;

    await myIpfs.start();
    window.myIpfs = myIpfs;

    F.initBlockRoom();
    F.initTaskRoom();
    F.initTownHall();

    myChart.render();
  },

  initTaskRoom(){
    taskRoom = myIpfs.registerRoom(C.taskRoom, {
      join(peer){
        log('peer ' + peer + ' joined task room');
      },
      left(peer){
        log('peer ' + peer + ' left task room');
      },
      subscribe(m){
        log("...... subscribe .... task room => "+m);
        
      },
      message(msg){
        log('task room got message from ' + msg.from + ': ' + msg.data.toString())

      }
    });
  },
  initBlockRoom(){
    blockRoom = myIpfs.registerRoom(C.blockRoom, {
      join(peer){
        log('peer ' + peer + ' joined block room');

        F.processNewJoinPeer(peer);

      },
      left(peer){
        log('peer ' + peer + ' left block room');

        myData.removePeerByIpfsId(peer);
      },
      subscribe(m){
        log("...... subscribe.... block room => "+m);
        
        F.publishSelfId()
      },
      message(msg){
        log('block room got message from ' + msg.from + ': ' + msg.data.toString())

        F.processMessage(msg);
      }
    });

    window.blockRoom = blockRoom;
  },
  initTownHall(){},

  async publishSelfId(){
    const obj = await myIpfs.node.id();
    C.user.ipfs_id = obj.id;
    _.delay(async ()=>{
      await $.ajax({
        url : '/poc/update_ipfs_id', 
        data : {
          user : encodeURIComponent(C.user.name),
          ipfs_id : obj.id
        },
        type : 'get'
      });

      myData.addPeer({
        name : C.user.name,
        pub : C.user.pub,
        pri : C.user.pri,
        ipfs_id : obj.id
      });
    }, 100);
  },

  processNewJoinPeer(ipfs_id){
    $.ajax({
      url : '/poc/get_user_by_ipfs',
      type : 'get',
      data : {
        ipfs_id
      }
    }).then((rs)=>{
      const user = rs.data;
      if(!user){
        return false;
      }

      myData.addPeer(user);
    })
  },

  async processMessage(message){
    const blockObj = tryParseJson(message.data);

    if(typeof blockObj === 'undefined'){
      return log('In block room got an non-parsable message from ' + message.from + ': ' + message.data.toString());
    }
    const {txType, cid} = blockObj;
    if(txType === 'newBlock'){
      const block = await myIpfs.node.dag.get(cid);
      console.log("received block:", block);
      // if(options.isProcessingBlock){
      //   throw new exceptions("Racing conditions found. Some async funciton is processing block while new block just came in, how to handle this issue?");
      // }
      
      myData.addBlock(block);

      log('receive new block, refresh data.');
      const list = myData.getAllListForChart();
      myChart.render(list);
      return true;
    }
    
    return log('In block room got an unhandled message from ' + message.from + ': ' + message.data.toString());
  }

};


window.poc = {
  createRaTask(){
    const json = {
      txType : 'newNodeJoinNeedRa',
      newPeerId : C.user.name,
      depositAmt : 10,
      ipfsPeerId : C.user.ipfs_id
    };
    const config = {
      url : '/poc/publish2room',
      type : 'post',
      data : {
        jsontext : JSON.stringify(json),
        room : ''
      }
    };

    $.ajax(config).then((rs)=>{
      console.log(rs);
      alert('success');
    })
  },
  transferGas(){
    const val = parseInt(prompt('please input the number you what to transfer to him', '10'), 10);

    if(!_.isNumber(val) || _.isNaN(val)){
      alert('invalid input');
      return false;
    }
    
    const d = $('#js_node_detail').data('json');
    const json = {
      txType: 'gasTransfer',
      fromPeerId: C.user.name,
      toPeerId: d.name,
      amt: val
    };
    const config = {
      url : '/poc/publish2room',
      type : 'post',
      data : {
        jsontext : JSON.stringify(json),
        room : ''
      }
    };

    $.ajax(config).then((rs)=>{
      console.log(rs);
      alert('success');
    })

  },
  sendTaskMessage(){
    const val = prompt('please leave the message to him', '');

    if(!val){
      alert('invalid input');
      return false;
    }
    
    const d = $('#js_node_detail').data('json');
    taskRoom.sendTo(d.ipfs_id, val);
    alert('success');
  }
};

$(async ()=>{
  F.loading(true);
  await F.init();
  F.loading(false);
})
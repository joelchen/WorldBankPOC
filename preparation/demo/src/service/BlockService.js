import Base from './Base';
import constant from './constant';
import _ from 'lodash';
import BlockSchema from './BlockSchema';


export default class extends Base {
  init(){
    this.generateGenesisBlock();

    const s = 1000*60;

    const loop = async ()=>{
      await this.generateBlock();
      setTimeout(async ()=>{
        await loop();
      }, s);
    };

    _.delay(loop, s);
  }

  async generateGenesisBlock(){
    const count = await BlockSchema.count({}).exec();
    if(count > 0){
      return false;
    }

    const d = {
      prev_hash : '-1',
      total_gas : 0,
      total_credit : 0,
      tx_log : [],
      block_owner : 'God',
      height : 1
    };
    d.hash = this.hashBlock(d);

    return await BlockSchema.create(d);
  }

  async getLatestBlock(){
    const count = await BlockSchema.count({}).exec();
    if(count < 1){
      throw 'Need generate genesis block first';
    }
    return await BlockSchema.findOne({height: count}).exec();
  }

  async getHeight(){
    const cur = await this.getLatestBlock();
    return cur.height;
  }

  async generateBlock(){
    const prev_block = await this.getLatestBlock();
    const total_gas = await this.getTotalGas();
    const total_credit = await this.getTotalCredit();
    const tx_log = await this.getTxLogs(prev_block);
    const d = {
      prev_hash : prev_block.hash,
      total_gas,
      total_credit,
      tx_log,
      block_owner : this.selectBlockOwner(),
      height : prev_block.height+1
    };
    d.hash = this.hashBlock(d);
    console.log('generate block => ', JSON.stringify(d));
    return await BlockSchema.create(d); 
  }

  async getTotalGas(){
    const gasSchema = this.util.gasSchema();
    let total = 0;
    const list = await gasSchema.find({}).exec();
    _.each(list, (item)=>{
      total += item.gasBalance;
    });

    return total;
  }

  async getTotalCredit(){
    const creditSchema = this.util.creditSchema();
    let total = 0;
    const list = await creditSchema.find({}).exec();
    _.each(list, (item)=>{
      total += item.creditScore;
    });
    return total;
  }

  async getTxLogs(prev_block){
    const time = prev_block.createdAt;
    const txLogSchema = this.util.txLogSchema();
    const list = await txLogSchema.find({
      createdAt : {
        $gt : time
      }
    }).exec();

    const tx_ids = _.map(list, (item)=>item._id);
    return tx_ids;
  }

  selectBlockOwner(){
    return 'God';
  }

  hashBlock(data){
    const content = {
      prev_hash : data.prev_hash,
      total_gas : data.total_gas,
      total_credit : data.total_credit,
      tx_log : data.tx_log
    };
    return this.util.hash(JSON.stringify(content));
  }

  
};
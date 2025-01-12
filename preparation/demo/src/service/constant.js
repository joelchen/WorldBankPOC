import {gasFaucetPeerId, gasBurnPeerId, totalCreditToken, thresholdForVrfRa, creditRewardToEverySuccessfulRa, creditPentaltyToEverySuccessfulRa} from '../poc/constValue';

export default {
  gasFaucetPeerId,
  gasBurnPeerId,
  
  CREDIT_SCORE_POOL : 'credit_score_pool',

  MAX_CREDIT_SCORE: totalCreditToken,
  EACH_CREDIT_SCORE_FOR_VRF: thresholdForVrfRa,
  REWARD_FOR_CREDIT_SCORE: creditRewardToEverySuccessfulRa,
  PENALTY_FOR_CREDIT_SCORE: creditPentaltyToEverySuccessfulRa,
  task_status : {
    'ELECT' : 'elect',
    'PROCESSING' : 'processing',
    'COMPLETED' : 'completed'
  },
  task_type : {
    'REMOTE_ATTESTATION' : 'remote_attestation',
    'CALCULATE' : 'calculate'
  },

  txlog_type : {
    'PUBLISH_CAlCULATE' : 'CalculateTaskDepositGas_ref_peer',
    'PUBLISH_RA' : 'RaTaskDepositGas',
    'JOSIN_RA' : 'RaTaskDepositGas',
    'JOIN_CAlCULATE' : 'CalculateTaskDepositGas_join_ref_peer',
    'REWARD_GAS' : 'Task_reward_gas',
    'REWARD_CREDIT': 'Task_reward_credit',
    'PENALTY_CREDIT': 'Task_penalty_credit',
    'REWARD_CREDIT_FOR_RA_PASS': 'Task_reward_gas_for_ra_pass'
  },

  RA_TASK_GAS : 10,


  MAX_TASK_JOINER : 5
};
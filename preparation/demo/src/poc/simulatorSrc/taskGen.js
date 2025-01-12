// create the editor
var container = document.getElementById("jsoneditor");
var options = {};
var editor = new JSONEditor(container, options);

document.addEventListener("DOMContentLoaded", ()=>{
    // Handler when the DOM is fully loaded
    // set json
  var json = {
    taskType:"RaNewNode",
    potCid:"--placeholder--",
    paymentTxId:"--placeholder--"
  };
  editor.set(json);


  document.getElementById('showjson').onclick = showJsonHandler;
  document.getElementById('btn1').onclick = ()=>{
    editor.set({
      txType:"gasTransfer",
      fromPeerId:"user #2",
      toPeerId:"user #3",
      amt:50
    })
  };
  document.getElementById('btn2').onclick = ()=>{
    editor.set({
      txType:"newNodeJoinNeedRa",
      newPeerId:"user #0",
      depositAmt:10,
      ipfsPeerId:"placeholder"

    })
  };;
  document.getElementById('btn3').onclick = ()=>{
    editor.set({
      txType:"computationTask",
      cid:""
    })
  };;
  document.getElementById('btn4').onclick = ()=>{
    editor.set({
      txType:"placeHolder"
    })
  };;
});

const showJsonHandler = ()=>{
  const json = editor.get();
  console.log('json, ', json);

  document.getElementById('jsontext').innerHTML = JSON.stringify(json, null, 2);
};

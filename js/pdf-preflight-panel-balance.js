(function(){
  if(window.__pdfPreflightPanelBalanceV1)return;
  window.__pdfPreflightPanelBalanceV1=true;

  function install(){
    if(document.getElementById('pdfPreflightPanelBalanceStyles'))return;
    const style=document.createElement('style');
    style.id='pdfPreflightPanelBalanceStyles';
    style.textContent=`
      @media(min-width:821px){
        .workspace{align-items:stretch!important}
        .workspace>.panel{
          height:100%!important;
          display:flex!important;
          flex-direction:column!important;
        }
        .workspace>.panel:first-child .status-stack{
          margin-top:auto!important;
          padding-top:20px!important;
        }
        .workspace>.panel:nth-child(2) .reset-bar-btn{
          margin-top:auto!important;
        }
      }
      @media(max-width:820px){
        .workspace>.panel{height:auto!important}
      }
    `;
    document.head.appendChild(style);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
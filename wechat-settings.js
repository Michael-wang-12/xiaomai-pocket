(()=>{
 const $=id=>document.getElementById(id),style=document.createElement('style');
 style.textContent='.wechat-card{margin:18px 0;padding:14px;background:#eaf0e3;border:1px solid #d4dfca;border-radius:15px}.wechat-card strong{display:block;font-size:14px}.wechat-card p{font-size:12px;line-height:1.7;margin:7px 0 12px;color:#65785d}.wechat-card button{min-height:42px;padding:10px 14px;background:var(--green);color:white;border-radius:11px}.wechat-guide{padding-left:22px}.wechat-guide li{padding:5px 0;line-height:1.85}.wechat-note{padding:12px;border:1px solid #d8e2cf;background:#eef3e9;border-radius:12px;font-size:12px;line-height:1.85}';document.head.append(style);
 function guide(){
  openSheet('把小麦接到微信','<p>以后也可以在微信的 ClawBot 单聊里找小麦。微信和网页使用同一个小麦人设、同一个模型及现有 API 额度。</p><ol class="wechat-guide"><li>先由小麦的接入服务生成临时绑定二维码或官方授权入口。</li><li>用 <b>UU 的微信</b> 扫码或打开授权页，按微信提示完成确认。若微信要求数字确认，请只在绑定窗口完成。</li><li>绑定后，在微信的 ClawBot 专用单聊中给小麦发一句话，确认能收到回复。</li></ol><div class="wechat-note"><b>首次连接说明</b><br>绑定二维码需要接入服务在线时生成，不是在这里填写模型密钥。这里的说明不会自行登录或发消息。<br><br>微信收发需要独立接入服务在线；网页仍可单独使用。两边的聊天记录和已教例句目前各自保存。</div><p class="small">微信中可在「我 → 设置 → 插件」查找微信 ClawBot；入口与授权提示以你的微信版本实际显示为准。</p><button class="primary" id="wechatGuideBack">返回设置</button>','wechat-guide');
  $('wechatGuideBack').onclick=()=>window.XM_WECHAT.settingsPage();
 }
 function mount(){const box=$('wechatSettings');if(!box)return;box.innerHTML='<div class="wechat-card"><strong>微信 ClawBot</strong><p>在微信里也能找小麦聊天。首次使用需由 UU 扫码绑定。</p><button id="wechatConnect" type="button">连接微信 · 查看绑定步骤</button></div>';$('wechatConnect').onclick=guide}
 window.XM_WECHAT={settings:mount,settingsPage:()=>settings(),guide};
})();

const STORAGE_KEY='today_eat_pwa_dishes_v1';
const WEEKLY_KEY='today_eat_pwa_weekly_v1';
const UI_KEY='today_eat_pwa_ui_v1';

const categories=['全部','家常菜','减脂餐','素菜','荤菜','主食','汤类','快手菜'];
const goals=['减脂','清淡','高蛋白','快手','下饭','少油少盐'];
const weekDays=[
  {key:'mon',day:'周一'},
  {key:'tue',day:'周二'},
  {key:'wed',day:'周三'},
  {key:'thu',day:'周四'},
  {key:'fri',day:'周五'},
  {key:'sat',day:'周六'},
  {key:'sun',day:'周日'}
];

let deferredInstallPrompt=null;
let installReady=false;

let state={
  currentPage:'home',
  dishes:[],
  currentCategory:'全部',
  dishSearch:'',
  shoppingSearch:'',
  shoppingSelected:new Set(),
  weekly:[],
  picker:{dayKey:'',mealType:'',keyword:'',selected:new Set()},
  selectedGoals:new Set(['减脂']),
  imageData:''
};

const $=id=>document.getElementById(id);

function uid(){
  return 'd_'+Date.now()+'_'+Math.random().toString(16).slice(2);
}

/* ===== 热量估算参考表（每 100 克熟食的大致热量，仅供粗略参考）===== */
const CAL_PER_100G_BY_CATEGORY={
  '家常菜':130,'减脂餐':90,'素菜':70,'荤菜':210,'主食':170,'汤类':45,'快手菜':130
};
const CAL_PER_100G_BY_DISH={
  '番茄炒蛋':110,'西红柿炒蛋':110,'青椒肉丝':160,'清蒸鲈鱼':105,'清蒸鱼':105,
  '蒜蓉生菜':60,'香煎鸡胸肉':165,'鸡胸肉':130,'红烧肉':470,'宫保鸡丁':200,
  '麻婆豆腐':150,'鱼香肉丝':170,'清炒时蔬':70,'炒青菜':70,'米饭':116,'白米饭':116,
  '蛋炒饭':190,'炒饭':190,'西红柿鸡蛋汤':35,'紫菜蛋花汤':30,'白煮蛋':145,'水煮蛋':145,
  '牛肉面':130,'炒河粉':200,'糖醋里脊':240,'可乐鸡翅':210,'土豆丝':100,'酸辣土豆丝':100
};
const DEFAULT_PORTION_G=250;

// 根据菜名 + 分类 + 重量，估算一份菜的大致热量（返回整数 kcal）
function estimateDishCalories(name,category,weight){
  const grams=Number(weight)>0?Number(weight):DEFAULT_PORTION_G;
  const key=(name||'').trim();
  let per100=null;
  if(key){
    if(CAL_PER_100G_BY_DISH[key]!=null) per100=CAL_PER_100G_BY_DISH[key];
    else{
      for(const dish in CAL_PER_100G_BY_DISH){
        if(key.includes(dish)||dish.includes(key)){per100=CAL_PER_100G_BY_DISH[dish];break;}
      }
    }
  }
  let matchedBy='dish';
  if(per100==null){per100=CAL_PER_100G_BY_CATEGORY[category]||130;matchedBy='category';}
  const kcal=Math.round(per100*grams/100/5)*5; // 取整到 5 的倍数，提示是估算值
  return {kcal,grams,matchedBy};
}

function handleEstimateCalories(silent){
  const name=$('dishNameInput').value.trim();
  const category=$('dishCategoryInput').value||'家常菜';
  const weight=$('dishWeightInput').value;
  const {kcal,grams,matchedBy}=estimateDishCalories(name,category,weight);
  $('dishCaloriesInput').value=kcal;
  const basis=matchedBy==='dish'?'按菜名匹配':'按分类「'+category+'」';
  $('estimateHint').textContent='已估算：约 '+grams+' 克 · '+basis+' ≈ '+kcal+' kcal（可手动修改）。';
  if(!silent) toast('已估算 ≈ '+kcal+' kcal');
}

// 重量框输入时自动估算（不弹提示，避免每敲一下都跳）
function autoEstimateOnWeight(){
  if($('dishWeightInput').value.trim()!=='') handleEstimateCalories(true);
}


function defaultDishes(){
  return [
    {id:uid(),name:'番茄炒蛋',category:'家常菜',taste:'酸甜',method:'炒',difficulty:'简单',calories:320,tags:['快手','下饭'],ingredients:['番茄','鸡蛋','葱'],image:'',note:'少油版更适合晚餐。'},
    {id:uid(),name:'青椒肉丝',category:'家常菜',taste:'咸香',method:'炒',difficulty:'中等',calories:430,tags:['下饭'],ingredients:['青椒','瘦肉','蒜'],image:'',note:''},
    {id:uid(),name:'清蒸鲈鱼',category:'减脂餐',taste:'清淡',method:'蒸',difficulty:'中等',calories:360,tags:['高蛋白','少油'],ingredients:['鲈鱼','姜','葱'],image:'',note:'适合清淡晚餐。'},
    {id:uid(),name:'蒜蓉生菜',category:'素菜',taste:'清爽',method:'炒',difficulty:'简单',calories:120,tags:['快手','蔬菜'],ingredients:['生菜','蒜'],image:'',note:''},
    {id:uid(),name:'香煎鸡胸肉',category:'减脂餐',taste:'咸香',method:'煎',difficulty:'简单',calories:280,tags:['高蛋白','减脂'],ingredients:['鸡胸肉','黑胡椒','生菜'],image:'',note:'控制油量，口感会更干净。'}
  ];
}

function saveDishes(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state.dishes));
}

function loadDishes(){
  const raw=localStorage.getItem(STORAGE_KEY);
  if(!raw){
    state.dishes=defaultDishes();
    saveDishes();
    return;
  }
  try{
    state.dishes=JSON.parse(raw)||[];
  }catch(e){
    state.dishes=defaultDishes();
    saveDishes();
  }
}

function normalizeMealValue(value){
  if(Array.isArray(value)) return value.filter(Boolean);
  if(typeof value==='string' && value.trim()){
    return value.split(/[、,，;]/).map(s=>s.trim()).filter(Boolean);
  }
  return [];
}

function displayMeal(value){
  const arr=normalizeMealValue(value);
  return arr.join('、');
}

function defaultWeekly(){
  return weekDays.map(item=>({...item,breakfast:[],lunch:[],dinner:[]}));
}

function saveWeekly(){
  localStorage.setItem(WEEKLY_KEY,JSON.stringify(state.weekly));
}

function loadWeekly(){
  const raw=localStorage.getItem(WEEKLY_KEY);
  if(!raw){
    state.weekly=defaultWeekly();
    saveWeekly();
    return;
  }
  try{
    const data=JSON.parse(raw);
    state.weekly=weekDays.map(day=>{
      const old=data.find(item=>item.key===day.key)||{};
      return {
        ...day,
        breakfast: normalizeMealValue(old.breakfast),
        lunch: normalizeMealValue(old.lunch),
        dinner: normalizeMealValue(old.dinner)
      };
    });
  }catch(e){
    state.weekly=defaultWeekly();
    saveWeekly();
  }
}


function saveUI(){
  localStorage.setItem(UI_KEY,JSON.stringify({
    currentPage:state.currentPage
  }));
}

function loadUI(){
  try{
    const raw=localStorage.getItem(UI_KEY);
    if(!raw) return;
    const data=JSON.parse(raw)||{};
    const valid=['home','dishes','shopping','weekly','ai'];
    if(valid.includes(data.currentPage)) state.currentPage=data.currentPage;
  }catch(e){}
}

function applyCurrentPageUI(){
  document.querySelectorAll('.tab-page').forEach(el=>el.classList.remove('active'));
  const pageEl=$("page-"+state.currentPage);
  if(pageEl) pageEl.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===state.currentPage));
}

function toast(msg){
  const el=$('toast');
  el.textContent=msg;
  el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'),1600);
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast('已复制');
  }catch(e){
    const textarea=document.createElement('textarea');
    textarea.value=text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    toast('已复制');
  }
}

function switchPage(page){
  state.currentPage=page;
  saveUI();
  applyCurrentPageUI();
  render();
}

function escapeHtml(text){
  return String(text||'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}

function normalizeList(text){
  return String(text||'').split(/[、,，\n]/).map(s=>s.trim()).filter(Boolean);
}

function getFilteredDishes(){
  let dishes=[...state.dishes];
  if(state.currentCategory!=='全部') dishes=dishes.filter(d=>(d.category||'家常菜')===state.currentCategory);
  const q=state.dishSearch.trim().toLowerCase();
  if(q){
    dishes=dishes.filter(d=>[
      d.name,d.category,d.taste,d.method,d.difficulty,d.note,
      ...(d.ingredients||[]),...(d.tags||[])
    ].join(' ').toLowerCase().includes(q));
  }
  return dishes;
}

function getDishIdFromElement(el){
  const card=el && el.closest ? el.closest('.dish-card') : null;
  return card ? card.dataset.id : (el && el.dataset ? el.dataset.id : '');
}

function dishCard(dish,options={}){
  const tags=[
    `<span class="tag accent">${escapeHtml(dish.category||'家常菜')}</span>`,
    dish.taste?`<span class="tag">${escapeHtml(dish.taste)}</span>`:'',
    dish.method?`<span class="tag">${escapeHtml(dish.method)}</span>`:'',
    dish.difficulty?`<span class="tag">${escapeHtml(dish.difficulty)}</span>`:'',
    ...(dish.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`)
  ].join('');

  const imageHtml=dish.image
    ? `<img class="dish-cover quick-image" src="${dish.image}" alt="${escapeHtml(dish.name)}">`
    : `<div class="image-placeholder quick-image">点这里添加图片</div>`;

  return `
    <div class="dish-card" data-id="${dish.id}">
      ${imageHtml}
      <div class="dish-head">
        <div class="dish-name">${escapeHtml(dish.name)}</div>
        <div class="ios-menu-wrap">
          <button class="ios-more-btn" aria-label="更多操作">···</button>
          <div class="ios-pop-menu">
            <button class="ios-menu-item edit-dish">编辑</button>
            <button class="ios-menu-item image-dish">图片</button>
            <button class="ios-menu-item delete-dish">删除</button>
          </div>
        </div>
      </div>
      <div class="tag-wrap">${tags}</div>
      <div class="ingredients">食材：${escapeHtml((dish.ingredients||[]).join('、')||'未填写')}</div>
      <div class="calorie-text">热量：约 ${escapeHtml(dish.calories||'未填写')} kcal</div>
      ${dish.note?`<div class="ingredients">备注：${escapeHtml(dish.note)}</div>`:''}
      ${(dish.tags||[]).join('').includes('减脂')||(dish.calories&&Number(dish.calories)<=350)?'<span class="slim-badge">减脂友好</span>':''}
    </div>
  `;
}

function renderHome(){
  const list=$('recommendList');
  if(!state.dishes.length){
    list.innerHTML='<div class="card empty-tip">菜品库还没有菜，先去添加几个吧。</div>';
    return;
  }
  const selected=[...state.dishes].sort(()=>Math.random()-.5).slice(0,Math.min(3,state.dishes.length));
  list.innerHTML=selected.map(d=>dishCard(d)).join('');
}

function renderDishes(){
  $('dishSearch').value=state.dishSearch;
  $('categoryGrid').innerHTML=categories.map(c=>`<button class="category-chip ${state.currentCategory===c?'active':''}" data-category="${c}">${c}</button>`).join('');
  const dishes=getFilteredDishes();
  $('dishTotal').textContent=`共 ${state.dishes.length} 道菜`;
  $('dishShowing').textContent=`当前显示 ${dishes.length} 道`;
  $('dishList').innerHTML=dishes.length?dishes.map(d=>dishCard(d)).join(''):'<div class="dish-card empty-tip">没有找到匹配的菜，试试换个关键词或分类。</div>';
}

function renderShopping(){
  const q=state.shoppingSearch.trim().toLowerCase();
  const dishes=state.dishes.filter(d=>!q||[d.name,...(d.ingredients||[])].join(' ').toLowerCase().includes(q));
  $('shoppingSearch').value=state.shoppingSearch;
  $('shoppingDishList').innerHTML=dishes.map(d=>`<label class="select-row"><input type="checkbox" data-id="${d.id}" ${state.shoppingSelected.has(d.id)?'checked':''}><span>${escapeHtml(d.name)}</span></label>`).join('')||'<div class="empty-tip">没有找到菜品。</div>';

  const ingredientMap={};
  state.dishes.filter(d=>state.shoppingSelected.has(d.id)).forEach(d=>(d.ingredients||[]).forEach(i=>{ingredientMap[i]=(ingredientMap[i]||0)+1}));
  const lines=Object.keys(ingredientMap).map(i=>`• ${i}${ingredientMap[i]>1?' × '+ingredientMap[i]:''}`);
  $('shoppingResult').textContent=lines.length?lines.join('\n'):'还没有选择菜品。';
}

function mealBox(day,type,label){
  const value=displayMeal(day[type]);
  return `<div class="meal-box"><div class="meal-label">${label}</div><div class="meal-value ${value?'':'meal-empty'}">${escapeHtml(value||'点击选择'+label)}</div><div class="meal-actions"><button class="mini-btn pick-meal" data-day="${day.key}" data-meal="${type}">选择</button>${value?`<button class="mini-btn clear-meal" data-day="${day.key}" data-meal="${type}">清除</button>`:''}</div></div>`;
}

function renderWeekly(){
  let b=0,l=0,d=0;
  state.weekly.forEach(item=>{
    if(normalizeMealValue(item.breakfast).length) b++;
    if(normalizeMealValue(item.lunch).length) l++;
    if(normalizeMealValue(item.dinner).length) d++;
  });
  $('weeklySummary').innerHTML=`<div class="summary-item">早餐 ${b} 次</div><div class="summary-item">午餐 ${l} 次</div><div class="summary-item">晚餐 ${d} 次</div>`;
  $('weeklyList').innerHTML=state.weekly.map((day,index)=>`<div class="week-card"><div class="week-head"><div class="week-day">${day.day}</div><div class="week-date">第 ${index+1} 天</div></div><div class="meal-row">${mealBox(day,'breakfast','早餐')}${mealBox(day,'lunch','午餐')}${mealBox(day,'dinner','晚餐')}</div></div>`).join('');
}

function renderGoals(){
  $('goalGrid').innerHTML=goals.map(g=>`<button class="goal-chip ${state.selectedGoals.has(g)?'active':''}" data-goal="${g}">${g}</button>`).join('');
}

function render(){
  if(state.currentPage==='home') renderHome();
  if(state.currentPage==='dishes') renderDishes();
  if(state.currentPage==='shopping') renderShopping();
  if(state.currentPage==='weekly') renderWeekly();
  if(state.currentPage==='ai') renderGoals();
}

function openDishModal(dish){
  $('dishModalTitle').textContent=dish?'编辑菜品':'新增菜品';
  $('editDishId').value=dish?dish.id:'';
  $('dishNameInput').value=dish?dish.name||'':'';
  $('dishCategoryInput').value=dish?dish.category||'家常菜':'家常菜';
  $('dishTasteInput').value=dish?dish.taste||'':'';
  $('dishMethodInput').value=dish?dish.method||'':'';
  $('dishDifficultyInput').value=dish?dish.difficulty||'':'';
  $('dishCaloriesInput').value=dish?dish.calories||'':'';
  $('dishWeightInput').value=dish?dish.weight||'':'';
  $('estimateHint').textContent=dish&&dish.weight?('已保存重量约 '+dish.weight+' 克，修改重量会自动重新估算热量（可手动改）。'):'填入重量后会自动估算热量并填入上面的热量框，结果可手动修改。重量留空点"估算热量"则按一份约 250 克估算。';
  $('dishIngredientsInput').value=dish?(dish.ingredients||[]).join('、'):'';
  $('dishTagsInput').value=dish?(dish.tags||[]).join('、'):'';
  $('dishNoteInput').value=dish?dish.note||'':'';
  state.imageData=dish?dish.image||'':'';

  if(state.imageData){
    $('imagePreview').src=state.imageData;
    $('imagePreview').classList.remove('hidden');
  }else{
    $('imagePreview').classList.add('hidden');
  }

  $('dishImageInput').value='';
  $('dishModal').classList.remove('hidden');
}

function closeDishModal(){
  $('dishModal').classList.add('hidden');
}

function compressImageFile(file,targetKB=100,maxW=960,maxH=720){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('图片读取失败'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('图片加载失败'));
      img.onload=()=>{
        let w=img.width;
        let h=img.height;
        const ratio=Math.min(1,maxW/w,maxH/h);
        w=Math.max(1,Math.round(w*ratio));
        h=Math.max(1,Math.round(h*ratio));

        const canvas=document.createElement('canvas');
        canvas.width=w;
        canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#FFFFFF';
        ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);

        let quality=0.82;
        let dataUrl=canvas.toDataURL('image/jpeg',quality);
        const targetBytes=targetKB*1024;

        while(dataUrl.length*0.75>targetBytes && quality>0.38){
          quality-=0.08;
          dataUrl=canvas.toDataURL('image/jpeg',quality);
        }

        if(dataUrl.length*0.75>targetBytes){
          const scale=Math.sqrt(targetBytes/(dataUrl.length*0.75))*0.95;
          const canvas2=document.createElement('canvas');
          canvas2.width=Math.max(1,Math.round(w*scale));
          canvas2.height=Math.max(1,Math.round(h*scale));
          const ctx2=canvas2.getContext('2d');
          ctx2.fillStyle='#FFFFFF';
          ctx2.fillRect(0,0,canvas2.width,canvas2.height);
          ctx2.drawImage(img,0,0,canvas2.width,canvas2.height);
          dataUrl=canvas2.toDataURL('image/jpeg',0.68);
        }

        resolve(dataUrl);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function fileToCompressedDataUrl(file){
  if(!file) return '';
  try{
    return await compressImageFile(file,100,960,720);
  }catch(e){
    return new Promise(resolve=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>resolve('');
      reader.readAsDataURL(file);
    });
  }
}

async function saveDishFromModal(){
  const name=$('dishNameInput').value.trim();
  if(!name){
    toast('请填写菜名');
    return;
  }

  const id=$('editDishId').value||uid();
  const old=state.dishes.find(d=>d.id===id);
  const dish={
    id,
    name,
    category:$('dishCategoryInput').value||'家常菜',
    taste:$('dishTasteInput').value.trim(),
    method:$('dishMethodInput').value.trim(),
    difficulty:$('dishDifficultyInput').value.trim(),
    calories:Number($('dishCaloriesInput').value)||'',
    weight:Number($('dishWeightInput').value)||'',
    ingredients:normalizeList($('dishIngredientsInput').value),
    tags:normalizeList($('dishTagsInput').value),
    note:$('dishNoteInput').value.trim(),
    image:state.imageData||''
  };

  state.dishes=old?state.dishes.map(d=>d.id===id?dish:d):[dish,...state.dishes];
  saveDishes();
  closeDishModal();
  toast('已保存');
  render();
}

function deleteDish(id){
  const dish=state.dishes.find(d=>d.id===id);
  if(!dish) return;
  if(confirm('确认删除「'+dish.name+'」吗？')){
    state.dishes=state.dishes.filter(d=>d.id!==id);
    saveDishes();
    render();
    toast('已删除');
  }
}

function openQuickImage(id){
  const dish=state.dishes.find(d=>d.id===id);
  if(!dish) return;
  const input=$('quickImageInput');
  input.value='';
  input.dataset.dishId=id;
  input.click();
}

async function saveQuickImage(file,id){
  if(!file||!id) return;
  toast('正在压缩图片...');
  const dataUrl=await fileToCompressedDataUrl(file);
  if(!dataUrl){
    toast('图片处理失败');
    return;
  }
  state.dishes=state.dishes.map(d=>d.id===id?{...d,image:dataUrl}:d);
  saveDishes();
  render();
  toast('图片已保存');
}

function closeAllDishMenus(){
  document.querySelectorAll('.ios-pop-menu.show').forEach(el=>el.classList.remove('show'));
}

function handleDishCardClick(e){
  const more=e.target.closest('.ios-more-btn');
  const edit=e.target.closest('.edit-dish');
  const imgBtn=e.target.closest('.image-dish');
  const del=e.target.closest('.delete-dish');
  const quick=e.target.closest('.quick-image');

  if(more){
    e.stopPropagation();
    const wrap=more.closest('.ios-menu-wrap');
    if(!wrap) return;
    const menu=wrap.querySelector('.ios-pop-menu');
    if(!menu) return;
    const willShow=!menu.classList.contains('show');
    closeAllDishMenus();
    if(willShow) menu.classList.add('show');
    return;
  }

  if(edit){
    closeAllDishMenus();
    const id=getDishIdFromElement(edit);
    const dish=state.dishes.find(d=>d.id===id);
    if(dish) openDishModal(dish);
    return;
  }

  if(imgBtn){
    closeAllDishMenus();
    openQuickImage(getDishIdFromElement(imgBtn));
    return;
  }

  if(del){
    closeAllDishMenus();
    deleteDish(getDishIdFromElement(del));
    return;
  }

  if(quick){
    openQuickImage(getDishIdFromElement(quick));
  }
}

function openPicker(dayKey,mealType){
  if(!state.dishes.length){
    toast('请先添加菜品');
    return;
  }
  const day=state.weekly.find(w=>w.key===dayKey);
  const selected=new Set(normalizeMealValue(day?day[mealType]:[]));
  state.picker={dayKey,mealType,keyword:'',selected};
  const titleMap={breakfast:'选择早餐',lunch:'选择午餐',dinner:'选择晚餐'};
  $('pickerTitle').textContent=titleMap[mealType]||'选择菜品';
  $('pickerSearch').value='';
  renderPicker();
  $('pickerModal').classList.remove('hidden');
}

function closePicker(){
  $('pickerModal').classList.add('hidden');
}

function getPickerDishes(){
  const q=state.picker.keyword.trim().toLowerCase();
  if(!q) return state.dishes;
  return state.dishes.filter(d=>[d.name,d.category,...(d.ingredients||[])].join(' ').toLowerCase().includes(q));
}

function renderPicker(){
  const dishes=getPickerDishes();
  const count=state.picker.selected.size;
  $('pickerCount').textContent=`已选 ${count} 项`;
  $('pickerList').innerHTML=dishes.length?dishes.map(d=>{
    const checked=state.picker.selected.has(d.name);
    return `<label class="picker-item picker-check-item" data-name="${escapeHtml(d.name)}">
      <input type="checkbox" class="picker-check" data-name="${escapeHtml(d.name)}" ${checked?'checked':''}>
      <div>
        <div class="picker-name">${escapeHtml(d.name)}</div>
        <div class="picker-meta">${escapeHtml(d.category||'未分类')}${d.calories?' · 约 '+d.calories+' kcal':''}</div>
      </div>
    </label>`;
  }).join(''):'<div class="empty-tip">没有找到匹配的菜品</div>';
}

function applyPickerSelection(){
  const day=state.weekly.find(w=>w.key===state.picker.dayKey);
  if(!day) return;
  day[state.picker.mealType]=[...state.picker.selected];
  saveWeekly();
  closePicker();
  renderWeekly();
  toast('已保存');
}

function generatePrompt(){
  const selectedGoals=[...state.selectedGoals].join('、')||'没有特别限制';
  const health=$('healthInput').value.trim()||'没有特别身体情况，只想要合理、好吃、适合日常的饮食建议。';
  const available=$('availableIngredients').value.trim()||'没有明确库存食材，可以根据菜品库自由推荐。';
  const scene=$('mealScene').value.trim()||'晚餐';
  const people=$('peopleCount').value.trim()||'1人';
  const library=state.dishes.length?state.dishes.map((d,i)=>`${i+1}. ${d.name}｜分类：${d.category||'未填写'}｜热量：${d.calories||'未填写'} kcal｜口味：${d.taste||'未填写'}｜做法：${d.method||'未填写'}｜难度：${d.difficulty||'未填写'}｜标签：${(d.tags||[]).join('、')||'未填写'}｜食材：${(d.ingredients||[]).join('、')||'未填写'}${d.note?'｜备注：'+d.note:''}`).join('\n'):'我的菜品库目前还没有菜。';

  const prompt=`你是一位懂家常菜、营养搭配和减脂饮食的中文饮食助手。请根据我的情况，帮我推荐适合的一餐或菜单。

【我的目标】
${selectedGoals}

【身体情况 / 饮食需求】
${health}

【这次场景】
${scene}

【用餐人数】
${people}

【冰箱已有食材】
${available}

【我的菜品库】
${library}

请你按下面格式回答：
1. 优先推荐 1-3 个最适合的菜，尽量从我的菜品库里选择。
2. 简单说明为什么适合我的目标和身体情况。
3. 如果我已有食材不够，请列出还需要买什么。
4. 如果有更健康的做法，请告诉我怎么少油、少盐、控热量。
5. 回答要简洁、实用，不要写太长。`;

  $('promptText').textContent=prompt;
  $('promptCard').classList.remove('hidden');
  toast('已生成');
}

function exportData(){
  const data={
    app:'today-eat-pwa',
    version:'v5.12',
    exportedAt:new Date().toISOString(),
    dishes:state.dishes,
    weekly:state.weekly
  };
  $('backupText').textContent=JSON.stringify(data,null,2);
  $('backupText').classList.remove('hidden');
  $('backupActions').classList.remove('hidden');
  toast('已生成备份');
}

function importData(){
  const raw=$('importText').value.trim();
  if(!raw){
    toast('请先粘贴备份内容');
    return;
  }

  let data;
  try{
    data=JSON.parse(raw);
  }catch(e){
    toast('备份格式不正确');
    return;
  }

  if(!Array.isArray(data.dishes)){
    toast('没有识别到菜品数据');
    return;
  }

  if(!confirm('恢复后会覆盖当前浏览器里的菜品和周计划，是否继续？')) return;

  state.dishes=data.dishes;
  const weeklyData=Array.isArray(data.weekly)?data.weekly:(Array.isArray(data.weeklyPlan)?data.weeklyPlan:[]);
  if(weeklyData.length){
    state.weekly=weekDays.map(day=>{
      const old=weeklyData.find(item=>item.key===day.key)||{};
      return {
        ...day,
        breakfast: normalizeMealValue(old.breakfast),
        lunch: normalizeMealValue(old.lunch),
        dinner: normalizeMealValue(old.dinner)
      };
    });
  }

  saveDishes();
  saveWeekly();
  $('importText').value='';
  toast('恢复成功');
  render();
}


function updateInstallUI(){
  const btn=$('installAppBtn');
  const hint=$('installHint');
  if(!btn||!hint) return;

  const isStandalone=window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if(isStandalone){
    hint.textContent='已经是 App 模式打开，不需要重复安装。';
    btn.textContent='已安装';
    btn.disabled=true;
    btn.classList.add('disabled');
    return;
  }

  if(installReady&&deferredInstallPrompt){
    hint.textContent='浏览器已识别为可安装 App，点击按钮即可安装。';
    btn.textContent='安装应用';
    btn.disabled=false;
    btn.classList.remove('disabled');
  }else{
    hint.textContent='如果按钮暂时不能安装，说明 Chrome 还没触发 PWA 安装事件，可先清除本站缓存后重进。';
    btn.textContent='尝试安装';
    btn.disabled=false;
    btn.classList.remove('disabled');
  }
}

async function triggerInstallApp(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice.catch(()=>null);
    deferredInstallPrompt=null;
    installReady=false;
    updateInstallUI();
    if(choice&&choice.outcome==='accepted') toast('已开始安装');
    else toast('已取消安装');
    return;
  }

  toast('浏览器还没开放安装入口，请刷新后再试');
  updateInstallUI();
}

function initInstallPrompt(){
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    deferredInstallPrompt=e;
    installReady=true;
    updateInstallUI();
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    installReady=false;
    toast('安装成功');
    updateInstallUI();
  });

  setTimeout(updateInstallUI,700);
}

function bindEvents(){
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>switchPage(btn.dataset.page)));
  $('randomBtn').addEventListener('click',renderHome);

  $('dishSearch').addEventListener('input',e=>{
    state.dishSearch=e.target.value;
    renderDishes();
  });

  $('categoryGrid').addEventListener('click',e=>{
    const btn=e.target.closest('.category-chip');
    if(!btn) return;
    state.currentCategory=btn.dataset.category;
    renderDishes();
  });

  $('addDishBtn').addEventListener('click',()=>openDishModal());
  $('closeDishModal').addEventListener('click',closeDishModal);
  $('dishModal').addEventListener('click',e=>{
    if(e.target.id==='dishModal') closeDishModal();
  });
  $('saveDishBtn').addEventListener('click',saveDishFromModal);
  $('estimateCalBtn').addEventListener('click',()=>handleEstimateCalories(false));
  $('dishWeightInput').addEventListener('input',autoEstimateOnWeight);
  $('dishNameInput').addEventListener('input',autoEstimateOnWeight);
  $('dishCategoryInput').addEventListener('change',autoEstimateOnWeight);

  $('dishImageInput').addEventListener('change',async e=>{
    const file=e.target.files[0];
    if(!file) return;
    toast('正在压缩图片...');
    const dataUrl=await fileToCompressedDataUrl(file);
    if(!dataUrl){
      toast('图片处理失败');
      return;
    }
    state.imageData=dataUrl;
    $('imagePreview').src=state.imageData;
    $('imagePreview').classList.remove('hidden');
    toast('图片已压缩');
  });

  $('quickImageInput').addEventListener('change',e=>{
    const id=e.target.dataset.dishId;
    saveQuickImage(e.target.files[0],id);
  });

  $('dishList').addEventListener('click',handleDishCardClick);
  $('recommendList').addEventListener('click',handleDishCardClick);

  document.addEventListener('click',e=>{
    if(!e.target.closest('.ios-menu-wrap')){
      closeAllDishMenus();
    }
  });

  $('shoppingSearch').addEventListener('input',e=>{
    state.shoppingSearch=e.target.value;
    renderShopping();
  });

  $('shoppingDishList').addEventListener('change',e=>{
    if(e.target.type!=='checkbox') return;
    if(e.target.checked) state.shoppingSelected.add(e.target.dataset.id);
    else state.shoppingSelected.delete(e.target.dataset.id);
    renderShopping();
  });

  $('copyShoppingBtn').addEventListener('click',()=>copyText($('shoppingResult').textContent));

  $('weeklyList').addEventListener('click',e=>{
    const pick=e.target.closest('.pick-meal');
    const clear=e.target.closest('.clear-meal');

    if(pick) openPicker(pick.dataset.day,pick.dataset.meal);

    if(clear){
      const item=state.weekly.find(w=>w.key===clear.dataset.day);
      if(item){
        item[clear.dataset.meal]=[];
        saveWeekly();
        renderWeekly();
      }
    }
  });

  $('pickerSearch').addEventListener('input',e=>{
    state.picker.keyword=e.target.value;
    renderPicker();
  });

  $('pickerList').addEventListener('change',e=>{
    const box=e.target.closest('.picker-check');
    if(!box) return;
    const name=box.dataset.name;
    if(box.checked) state.picker.selected.add(name);
    else state.picker.selected.delete(name);
    renderPicker();
  });

  $('pickerList').addEventListener('click',e=>{
    const item=e.target.closest('.picker-check-item');
    if(!item || e.target.classList.contains('picker-check')) return;
    const box=item.querySelector('.picker-check');
    if(!box) return;
    box.checked=!box.checked;
    const name=box.dataset.name;
    if(box.checked) state.picker.selected.add(name);
    else state.picker.selected.delete(name);
    renderPicker();
  });

  $('pickerDoneBtn').addEventListener('click',applyPickerSelection);
  $('closePickerBtn').addEventListener('click',closePicker);
  $('pickerModal').addEventListener('click',e=>{
    if(e.target.id==='pickerModal') closePicker();
  });

  $('copyWeeklyBtn').addEventListener('click',()=>copyText(state.weekly.map(item=>`${item.day}：早餐 ${displayMeal(item.breakfast)||'-'}；午餐 ${displayMeal(item.lunch)||'-'}；晚餐 ${displayMeal(item.dinner)||'-'}`).join('\n')));

  $('clearWeeklyBtn').addEventListener('click',()=>{
    if(confirm('是否清空整周菜单规划？')){
      state.weekly=defaultWeekly();
      saveWeekly();
      renderWeekly();
    }
  });

  $('goalGrid').addEventListener('click',e=>{
    const btn=e.target.closest('.goal-chip');
    if(!btn) return;
    const goal=btn.dataset.goal;
    if(state.selectedGoals.has(goal)) state.selectedGoals.delete(goal);
    else state.selectedGoals.add(goal);
    renderGoals();
  });

  document.querySelectorAll('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>{
    const mode=btn.dataset.quick;

    if(mode==='slim'){
      state.selectedGoals=new Set(['减脂','清淡','高蛋白']);
      $('healthInput').value='我现在想减脂，晚餐希望清淡一点，不要太油，最好有蛋白质和蔬菜。';
      $('mealScene').value='晚餐';
    }

    if(mode==='simple'){
      state.selectedGoals=new Set(['快手','下饭']);
      $('healthInput').value='我今天不想做太复杂的菜，希望简单、家常、容易买菜。';
      $('mealScene').value='午餐或晚餐';
    }

    if(mode==='weekly'){
      state.selectedGoals=new Set(['减脂','清淡','高蛋白']);
      $('healthInput').value='我想安排一周菜单，希望尽量不重复，兼顾减脂、营养、家常和买菜方便。';
      $('mealScene').value='一周早餐、午餐和晚餐';
    }

    renderGoals();
    generatePrompt();
  }));

  if($('installAppBtn')) $('installAppBtn').addEventListener('click',triggerInstallApp);

  $('generatePromptBtn').addEventListener('click',generatePrompt);
  $('copyPromptBtn').addEventListener('click',()=>copyText($('promptText').textContent));
  $('clearPromptBtn').addEventListener('click',()=>{
    $('promptText').textContent='';
    $('promptCard').classList.add('hidden');
  });

  $('exportDataBtn').addEventListener('click',exportData);
  $('copyBackupBtn').addEventListener('click',()=>copyText($('backupText').textContent));
  $('clearBackupBtn').addEventListener('click',()=>{
    $('backupText').textContent='';
    $('backupText').classList.add('hidden');
    $('backupActions').classList.add('hidden');
  });
  $('importDataBtn').addEventListener('click',importData);
}

function initPWA(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
}

function init(){
  loadDishes();
  loadWeekly();
  loadUI();
  bindEvents();
  applyCurrentPageUI();
  initPWA();
  initInstallPrompt();
  render();
}

init();

const STORAGE_KEY='today_eat_pwa_dishes_v1';
const WEEKLY_KEY='today_eat_pwa_weekly_v1';

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

let state={
  currentPage:'home',
  dishes:[],
  currentCategory:'全部',
  dishSearch:'',
  shoppingSearch:'',
  shoppingSelected:new Set(),
  weekly:[],
  picker:{dayKey:'',mealType:'',keyword:''},
  selectedGoals:new Set(['减脂']),
  imageData:'',
  quickImageDishId:'',
  actionMenuDishId:''
};

const $=id=>document.getElementById(id);

function uid(){
  return 'd_'+Date.now()+'_'+Math.random().toString(16).slice(2);
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

function defaultWeekly(){
  return weekDays.map(item=>({...item,breakfast:'',lunch:'',dinner:''}));
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
    state.weekly=weekDays.map(day=>({...day,...(data.find(item=>item.key===day.key)||{})}));
  }catch(e){
    state.weekly=defaultWeekly();
    saveWeekly();
  }
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
  document.querySelectorAll('.tab-page').forEach(el=>el.classList.remove('active'));
  $('page-'+page).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.page===page));
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

function dishCard(dish,options={}){
  const tags=[
    `<span class="tag accent">${escapeHtml(dish.category||'家常菜')}</span>`,
    dish.taste?`<span class="tag">${escapeHtml(dish.taste)}</span>`:'',
    dish.method?`<span class="tag">${escapeHtml(dish.method)}</span>`:'',
    dish.difficulty?`<span class="tag">${escapeHtml(dish.difficulty)}</span>`:'',
    ...(dish.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`)
  ].join('');

  const imageHtml=dish.image
    ? `<img class="dish-cover quick-image" data-id="${dish.id}" src="${dish.image}" alt="${escapeHtml(dish.name)}">`
    : `<div class="image-placeholder quick-image" data-id="${dish.id}">点这里添加图片</div>`;

  return `
    <div class="dish-card" data-id="${dish.id}">
      ${imageHtml}
      <div class="dish-head">
        <div class="dish-name">${escapeHtml(dish.name)}</div>
      </div>
      <div class="tag-wrap">${tags}</div>
      <div class="ingredients">食材：${escapeHtml((dish.ingredients||[]).join('、')||'未填写')}</div>
      <div class="calorie-text">热量：约 ${escapeHtml(dish.calories||'未填写')} kcal</div>
      ${dish.note?`<div class="ingredients">备注：${escapeHtml(dish.note)}</div>`:''}
      ${(dish.tags||[]).join('').includes('减脂')||(dish.calories&&Number(dish.calories)<=350)?'<span class="slim-badge">减脂友好</span>':''}
      <div class="dish-actions-wrap">
        <div class="dish-action-menu ${state.actionMenuDishId===dish.id?'show':''}">
          <button class="mini-btn edit-dish" data-id="${dish.id}">编辑</button>
          <button class="mini-btn image-dish" data-id="${dish.id}">图片</button>
          <button class="mini-btn delete-dish" data-id="${dish.id}">删除</button>
        </div>
        <button class="dish-more-btn" data-id="${dish.id}">···</button>
      </div>
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
  const value=day[type];
  return `<div class="meal-box"><div class="meal-label">${label}</div><div class="meal-value ${value?'':'meal-empty'}">${escapeHtml(value||'点击选择'+label)}</div><div class="meal-actions"><button class="mini-btn pick-meal" data-day="${day.key}" data-meal="${type}">选择</button>${value?`<button class="mini-btn clear-meal" data-day="${day.key}" data-meal="${type}">清除</button>`:''}</div></div>`;
}

function renderWeekly(){
  let b=0,l=0,d=0;
  state.weekly.forEach(item=>{if(item.breakfast)b++;if(item.lunch)l++;if(item.dinner)d++});
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

function saveDishFromModal(){
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
  state.quickImageDishId=id;
  const input=$('quickImageInput');
  input.value='';
  input.click();
}

function saveQuickImage(file){
  if(!file||!state.quickImageDishId) return;
  const reader=new FileReader();
  reader.onload=()=>{
    state.dishes=state.dishes.map(d=>d.id===state.quickImageDishId?{...d,image:reader.result}:d);
    saveDishes();
    state.quickImageDishId='';
    render();
    toast('图片已保存');
  };
  reader.readAsDataURL(file);
}

function openPicker(dayKey,mealType){
  if(!state.dishes.length){
    toast('请先添加菜品');
    return;
  }
  state.picker={dayKey,mealType,keyword:''};
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
  $('pickerCount').textContent=`${dishes.length} 项`;
  $('pickerList').innerHTML=dishes.length?dishes.map(d=>`<div class="picker-item" data-id="${d.id}"><div class="picker-name">${escapeHtml(d.name)}</div><div class="picker-meta">${escapeHtml(d.category||'未分类')}${d.calories?' · 约 '+d.calories+' kcal':''}</div></div>`).join(''):'<div class="empty-tip">没有找到匹配的菜品</div>';
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
    version:'v5',
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
  if(Array.isArray(data.weekly)){
    state.weekly=weekDays.map(day=>({...day,...(data.weekly.find(item=>item.key===day.key)||{})}));
  }else if(Array.isArray(data.weeklyPlan)){
    state.weekly=weekDays.map(day=>({...day,...(data.weeklyPlan.find(item=>item.key===day.key)||{})}));
  }

  saveDishes();
  saveWeekly();
  $('importText').value='';
  toast('恢复成功');
  render();
}

function handleDishCardClick(e){
  const more=e.target.closest('.dish-more-btn');
  const edit=e.target.closest('.edit-dish');
  const imgBtn=e.target.closest('.image-dish');
  const del=e.target.closest('.delete-dish');
  const quick=e.target.closest('.quick-image');

  if(more){
    e.stopPropagation();
    state.actionMenuDishId = state.actionMenuDishId===more.dataset.id ? '' : more.dataset.id;
    render();
    return;
  }

  if(edit){
    state.actionMenuDishId='';
    const dish=state.dishes.find(d=>d.id===edit.dataset.id);
    if(dish) openDishModal(dish);
    return;
  }

  if(imgBtn){
    state.actionMenuDishId='';
    openQuickImage(imgBtn.dataset.id);
    return;
  }

  if(del){
    state.actionMenuDishId='';
    deleteDish(del.dataset.id);
    return;
  }

  if(quick){
    openQuickImage(quick.dataset.id);
  }
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

  $('dishImageInput').addEventListener('change',e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      state.imageData=reader.result;
      $('imagePreview').src=state.imageData;
      $('imagePreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  $('quickImageInput').addEventListener('change',e=>{
    saveQuickImage(e.target.files[0]);
  });

  $('dishList').addEventListener('click',handleDishCardClick);
  $('recommendList').addEventListener('click',handleDishCardClick);

  document.addEventListener('click',e=>{
    if(!e.target.closest('.dish-actions-wrap') && state.actionMenuDishId){
      state.actionMenuDishId='';
      render();
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
        item[clear.dataset.meal]='';
        saveWeekly();
        renderWeekly();
      }
    }
  });

  $('pickerSearch').addEventListener('input',e=>{
    state.picker.keyword=e.target.value;
    renderPicker();
  });

  $('pickerList').addEventListener('click',e=>{
    const item=e.target.closest('.picker-item');
    if(!item) return;
    const dish=state.dishes.find(d=>d.id===item.dataset.id);
    const day=state.weekly.find(w=>w.key===state.picker.dayKey);
    if(dish&&day){
      day[state.picker.mealType]=dish.name;
      saveWeekly();
      closePicker();
      renderWeekly();
    }
  });

  $('closePickerBtn').addEventListener('click',closePicker);
  $('pickerModal').addEventListener('click',e=>{
    if(e.target.id==='pickerModal') closePicker();
  });

  $('copyWeeklyBtn').addEventListener('click',()=>copyText(state.weekly.map(item=>`${item.day}：早餐 ${item.breakfast||'-'}；午餐 ${item.lunch||'-'}；晚餐 ${item.dinner||'-'}`).join('\n')));

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
  bindEvents();
  initPWA();
  render();
}

init();

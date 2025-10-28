;(function(){
    const el = id => document.getElementById(id);
    const $q = el('q'), $pageSize = el('pageSize'), $err = el('err'), $stats = el('stats'), $searchBtn = el('searchBtn');
    const $topic = el('topicFilter'), $category = el('categoryFilter');
    const $thead = el('thead'), $tbody = el('tbody'), $pager = el('pager');
    let RAW = [];
    let FILTERED = [];
    let state = { page: 1, pageSize: 20, pattern: '', topic: '', category: '' };
  
    function textOf(v){
      if (v == null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }
  
    function buildRegex(pattern){
      try{
        return { re: new RegExp(pattern, 'i'), error: null };
      }catch(e){
        return { re: null, error: e.message };
      }
    }
  
    function getWebpage(src){
      if (!src) return '';
      if (Array.isArray(src)){
        for (const s of src){ if (s && s.webpage) return s.webpage; }
        return '';
      }
      if (typeof src === 'object'){ return src.webpage ?? ''; }
      return '';
    }
  
    
    const COLUMNS_FIXED = [
      { header: 'Categoría', getText: r => textOf(r.categoria) },
      { header: 'Tópico', getText: r => textOf(r.nombre_topico) },
      { header: 'Título gráfico', getText: r => textOf(r.titulo) },
      { header: 'Sub-título', getText: r => textOf(r.bajada) },
      { header: 'URL gráfico', getText: r => textOf(getWebpage(r.sources)), render: (r) => {
          const url = getWebpage(r.sources);
          if (!url) return document.createTextNode('');
          const a = document.createElement('a');
          a.href = url; a.textContent = url; a.target = '_blank'; a.rel = 'noopener';
          return a;
        }
      },
      { header: 'Dataset', getText: r => textOf(r.nombre_archivo), render: (r) => {
          const href = r.link_dataset || '';
          const name = r.nombre_archivo || '';
          if (!href || !name) return document.createTextNode(name || '');
          const a = document.createElement('a');
          a.href = href; a.textContent = name; a.target = '_blank'; a.rel = 'noopener';
          return a;
        }
      },
      { header: 'Fuente', getText: r => textOf(r.fuente) },
      { header: 'Nota', getText: r => textOf(r.nota) }
    ];
  
    function renderHeader(){
      $thead.innerHTML = '';
      const tr = document.createElement('tr');
      for (const c of COLUMNS_FIXED){
        const th = document.createElement('th');
        th.textContent = c.header;
        tr.appendChild(th);
      }
      $thead.appendChild(tr);
    }
  
    function renderBody(rows){
      $tbody.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const row of rows){
        const tr = document.createElement('tr');
        for (const c of COLUMNS_FIXED){
          const td = document.createElement('td');
          if (c.render){
            const node = c.render(row);
            td.appendChild(node);
          }else{
            td.textContent = c.getText(row);
          }
          tr.appendChild(td);
        }
        frag.appendChild(tr);
      }
      $tbody.appendChild(frag);
    }
  
    function renderPager(total, page, pageSize){
      $pager.innerHTML = '';
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const btn = (label, target, disabled=false, active=false) => {
        const b = document.createElement('button');
        b.textContent = label;
        if (active) b.classList.add('active');
        if (disabled){ b.disabled = true; }
        else { b.addEventListener('click', () => { state.page = target; update(); }); }
        return b;
      };
      $pager.appendChild(btn('«', 1, page===1));
      $pager.appendChild(btn('‹', Math.max(1, page-1), page===1));
  
      const windowSize = 5;
      const start = Math.max(1, page - Math.floor(windowSize/2));
      const end = Math.min(totalPages, start + windowSize - 1);
      for (let p = Math.max(1, end - windowSize + 1); p <= end; p++){
        $pager.appendChild(btn(String(p), p, false, p===page));
      }
  
      $pager.appendChild(btn('›', Math.min(totalPages, page+1), page===totalPages));
      $pager.appendChild(btn('»', totalPages, page===totalPages));
  
      $stats.textContent = total === 0
        ? '0 resultados'
        : `Mostrando ${Math.min((page-1)*pageSize+1, total)}–${Math.min(page*pageSize, total)} de ${total}`;
    }
  
    function applyFilter(){
      // Filtrado por categoría y tópico
      let base = RAW.slice();
      if (state.category){
        base = base.filter(r => (r.categoria || '') === state.category);
      }
      if (state.topic){
        base = base.filter(r => (r.nombre_topico || r.topico || '') === state.topic);
      }
  
      // Filtrado por regex
      const pattern = state.pattern.trim();
      if (!pattern){
        $err.textContent = '';
        return base;
      }
      const { re, error } = buildRegex(pattern);
      if (error){
        $err.textContent = 'Regex inválida: ' + error;
        return base.slice(0, 0);
      }
      $err.textContent = '';
      return base.filter(row => {
        for (const c of COLUMNS_FIXED){
          if (re.test(c.getText(row))) return true;
        }
        return false;
      });
    }
  
    function update(){
      state.pageSize = parseInt($pageSize.value, 10);
      FILTERED = applyFilter();
      const total = FILTERED.length;
      const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page > totalPages) state.page = totalPages;
  
      const start = (state.page - 1) * state.pageSize;
      const pageRows = FILTERED.slice(start, start + state.pageSize);
  
      renderHeader();
      renderBody(pageRows);
      renderPager(total, state.page, state.pageSize);
    }
  
    function updateTopicFilter(){
      let filteredData = RAW;
      if (state.category){
        filteredData = RAW.filter(r => (r.categoria || '') === state.category);
      }
      const topics = Array.from(new Set(filteredData.map(r => r.nombre_topico || r.topico).filter(Boolean))).sort();
      const currentTopic = state.topic;
      $topic.innerHTML = '<option value="">Todos los tópicos</option>' + topics.map(t => `<option value="${t}">${t}</option>`).join('');
      
      // Restaurar el tópico seleccionado si todavía existe en las opciones filtradas
      if (currentTopic && topics.includes(currentTopic)){
        $topic.value = currentTopic;
      } else {
        state.topic = '';
        $topic.value = '';
      }
    }
  
    async function loadData(){
      try{
        const res = await fetch('manifest.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('manifest no disponible');
        const manifest = await res.json(); // { items: [...] }
        const items = Array.isArray(manifest.items) ? manifest.items : [];
        RAW = items.length ? items : [];
      }catch(_){
        RAW = [];
      }
      // Poblar opciones de categoría
      const categories = Array.from(new Set(RAW.map(r => r.categoria).filter(Boolean))).sort();
      $category.innerHTML = '<option value="">Todas las categorías</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
      
      // Poblar opciones de tópico inicialmente con todos los tópicos
      updateTopicFilter();
      
      $pageSize.value = String(state.pageSize);
      update();
    }
  
       // Eventos
       $q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { state.page = 1; state.pattern = $q.value; update(); }
    });
    $q.addEventListener('input', () => { state.pattern = $q.value; });
    $pageSize.addEventListener('change', () => { state.page = 1; update(); });
    $category.addEventListener('change', () => { 
      state.page = 1; 
      state.category = $category.value; 
      updateTopicFilter();
      update(); 
    });
    $topic.addEventListener('change', () => { state.page = 1; state.topic = $topic.value; update(); });
    $searchBtn.addEventListener('click', () => { state.page = 1; state.pattern = $q.value; update(); });
  
    loadData();
  })();
(function(){
  var currentMode = 'study';
  var submitted = false;
  var timerInterval = null;
  var elapsed = 0;
  var remaining = 0;
  var isCountdown = false;
  var defaultTimeLimit = 120;
  var answers = {};
  var correctAnswers = {};
  var visibilityChangeCount = 0;
  var maxVisibilityWarnings = 3;
  var isShuffled = false;
  var originalOrder = []; // 保存原始题目顺序 [{node, parent, nextSibling}]

  function initAnswers() {
    document.querySelectorAll('.answer-content').forEach(function(el){
      var id = el.id;
      var match = el.innerHTML.match(/【答案】\s*([A-D]|[0-9.ⅠⅡⅢⅣ]+)/);
      if(match) {
        correctAnswers[id] = match[1].trim();
      }
    });
  }

  function buildUI() {
    var bar = document.createElement('div');
    bar.className = 'mode-bar show';
    bar.innerHTML =
      '<button class="mode-btn active" data-mode="study">&#128218; 学习模式</button>' +
      '<button class="mode-btn" data-mode="exam">&#128221; 考试模式</button>' +
      '<button class="shuffle-btn" id="shuffle-btn" style="display:none" onclick="window._examMode.toggleShuffle()">&#128256; 随机排序</button>' +
      '<button class="submit-btn" id="submit-btn" style="display:none" onclick="window._examMode.submit()">&#9989; 交卷</button>' +
      '<div class="exam-timer-display" id="mode-timer" style="display:none">' +
        '<span class="timer-minutes">00:00:00</span>' +
        '<button class="timer-toggle-btn" id="timer-toggle-btn" title="切换计时/倒计时" style="margin-left:8px;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-muted);cursor:pointer;font-size:.75rem">倒计时</button>' +
      '</div>';
    document.body.appendChild(bar);

    bar.querySelectorAll('.mode-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        window._examMode.switchMode(this.getAttribute('data-mode'));
      });
    });

    var toggleBtn = document.getElementById('timer-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        isCountdown = !isCountdown;
        toggleBtn.textContent = isCountdown ? '正计时' : '倒计时';
        if (currentMode === 'exam') {
          // 切换时保持时间连续性：将当前时间状态转换到另一种模式
          if (isCountdown) {
            // 正计时 → 倒计时：剩余 = 总时长 - 已用时
            remaining = Math.max(0, defaultTimeLimit * 60 - elapsed);
          } else {
            // 倒计时 → 正计时：已用时 = 总时长 - 剩余
            elapsed = Math.max(0, defaultTimeLimit * 60 - remaining);
          }
          stopTimer();
          startTimer(true); // true = 保持当前时间，不重置
        }
      });
    }
  }

  function switchMode(mode) {
    if(mode === currentMode) return;
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });

    var submitBtn = document.getElementById('submit-btn');
    var timer = document.getElementById('mode-timer');

    if(mode === 'exam') {
      document.body.classList.add('exam-mode');
      document.body.classList.remove('submitted');
      submitted = false;
      answers = {};
      elapsed = 0;
      remaining = defaultTimeLimit * 60;
      visibilityChangeCount = 0;
      submitBtn.style.display = '';
      submitBtn.disabled = false;
      timer.style.display = '';

      var shuffleBtn = document.getElementById('shuffle-btn');
      if (shuffleBtn) shuffleBtn.style.display = '';

      // 恢复原始顺序（如果之前打乱过）
      if (isShuffled) {
        restoreOrder();
        isShuffled = false;
        if (shuffleBtn) shuffleBtn.classList.remove('active');
      }

      document.querySelectorAll('.answer-content').forEach(function(el){
        el.classList.remove('show');
      });

      document.querySelectorAll('.result-badge').forEach(function(b){ b.remove(); });

      document.querySelectorAll('.question .options').forEach(function(optDiv){
        optDiv.onclick = function(e){
          if(submitted) return;
          var q = optDiv.closest('.question');
          q.classList.remove('selected-a','selected-b','selected-c','selected-d');
          var spans = optDiv.querySelectorAll('span');
          var clickedIdx = -1;
          spans.forEach(function(s,i){ if(s.contains(e.target) || s === e.target) clickedIdx = i; });
          if(clickedIdx < 0) return;
          var letters = ['A','B','C','D'];
          q.classList.add('selected-' + letters[clickedIdx].toLowerCase());
          var id = q.querySelector('.answer-content').id;
          answers[id] = letters[clickedIdx];
        };
      });

      startTimer();
      enableVisibilityGuard();

    } else {
      document.body.classList.remove('exam-mode', 'submitted');
      submitted = false;
      submitBtn.style.display = 'none';
      timer.style.display = 'none';
      stopTimer();
      disableVisibilityGuard();

      var shuffleBtn = document.getElementById('shuffle-btn');
      if (shuffleBtn) shuffleBtn.style.display = 'none';

      // 恢复原始顺序
      if (isShuffled) {
        restoreOrder();
        isShuffled = false;
        if (shuffleBtn) shuffleBtn.classList.remove('active');
      }

      // 移除错题面板
      var wp = document.getElementById('wrong-panel');
      if (wp) wp.remove();

      document.querySelectorAll('.answer-toggle').forEach(function(el){
        el.style.display = '';
      });

      document.querySelectorAll('.result-badge').forEach(function(b){ b.remove(); });
    }
  }

  function startTimer(preserveTime) {
    stopTimer();
    if (isCountdown) {
      if (!preserveTime) {
        remaining = defaultTimeLimit * 60;
      }
      updateCountdownDisplay();
      timerInterval = setInterval(function(){
        remaining--;
        updateCountdownDisplay();
        if (remaining <= 0) {
          stopTimer();
          window._examMode.submit();
        }
      }, 1000);
    } else {
      if (!preserveTime) {
        elapsed = 0;
      }
      updateTimerDisplay();
      timerInterval = setInterval(function(){
        elapsed++;
        updateTimerDisplay();
      }, 1000);
    }
  }

  function stopTimer() {
    if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerDisplay() {
    var m = Math.floor(elapsed / 60);
    var s = elapsed % 60;
    var h = Math.floor(m / 60);
    m = m % 60;
    var display = document.querySelector('#mode-timer .timer-minutes');
    if(display) {
      display.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
      display.style.color = '';
    }
  }

  function updateCountdownDisplay() {
    var totalSec = Math.max(0, remaining);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var display = document.querySelector('#mode-timer .timer-minutes');
    if(display) {
      display.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
      if (remaining <= 300) {
        display.style.color = '#d71920';
      } else if (remaining <= 600) {
        display.style.color = '#ff9800';
      } else {
        display.style.color = '';
      }
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function handleVisibilityChange() {
    if (currentMode !== 'exam' || submitted) return;
    if (document.hidden) {
      visibilityChangeCount++;
      if (visibilityChangeCount <= maxVisibilityWarnings) {
        var remaining_warnings = maxVisibilityWarnings - visibilityChangeCount;
        console.warn('[ExamGuard] 切屏检测 #' + visibilityChangeCount + '，剩余警告: ' + remaining_warnings);
      }
      if (visibilityChangeCount >= maxVisibilityWarnings) {
        alert('警告：考试期间多次切换页面，系统已记录。继续切屏将自动交卷。');
      }
    }
  }

  function enableVisibilityGuard() {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  function disableVisibilityGuard() {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    visibilityChangeCount = 0;
  }

  /**
   * Fisher-Yates 洗牌算法
   */
  function fisherYatesShuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /**
   * 按段落分组题目：将两个 .exam-section-title 之间的题目归为一组
   */
  function getSectionGroups() {
    var paper = document.querySelector('.exam-paper-inner');
    if (!paper) return [];
    var children = Array.from(paper.children);
    var groups = [];
    var currentGroup = null;

    children.forEach(function(child) {
      if (child.classList.contains('exam-section-title')) {
        currentGroup = { title: child, items: [] };
        groups.push(currentGroup);
      } else if (currentGroup &&
                 (child.classList.contains('question') ||
                  child.classList.contains('fill') ||
                  child.classList.contains('solution'))) {
        currentGroup.items.push(child);
      }
    });
    return groups;
  }

  /**
   * 保存当前题目顺序（用于恢复）
   */
  function saveOrder() {
    var paper = document.querySelector('.exam-paper-inner');
    if (!paper) return;
    originalOrder = Array.from(paper.children).map(function(node) {
      return node;
    });
  }

  /**
   * 恢复原始题目顺序
   */
  function restoreOrder() {
    if (originalOrder.length === 0) return;
    var paper = document.querySelector('.exam-paper-inner');
    if (!paper) return;
    originalOrder.forEach(function(node) {
      paper.appendChild(node);
    });
    renumberQuestions();
    // 重新绑定选项点击
    bindOptionClicks();
  }

  /**
   * 重新编号题目（更新 <b>N．</b> 标记）
   */
  function renumberQuestions() {
    var num = 1;
    document.querySelectorAll('.question, .fill, .solution').forEach(function(q) {
      var p = q.querySelector('p');
      if (p) {
        var b = p.querySelector('b');
        if (b) {
          // 保留原有的题号格式（如 "16．（12分）"）
          var text = b.textContent;
          var rest = text.replace(/^[0-9]+[．.]/, '');
          b.textContent = num + '．' + rest;
        }
      }
      num++;
    });
  }

  /**
   * 重新绑定选项点击事件（打乱顺序后需要重新绑定）
   */
  function bindOptionClicks() {
    document.querySelectorAll('.question .options').forEach(function(optDiv){
      optDiv.onclick = function(e){
        if(submitted) return;
        var q = optDiv.closest('.question');
        q.classList.remove('selected-a','selected-b','selected-c','selected-d');
        var spans = optDiv.querySelectorAll('span');
        var clickedIdx = -1;
        spans.forEach(function(s,i){ if(s.contains(e.target) || s === e.target) clickedIdx = i; });
        if(clickedIdx < 0) return;
        var letters = ['A','B','C','D'];
        q.classList.add('selected-' + letters[clickedIdx].toLowerCase());
        var id = q.querySelector('.answer-content').id;
        answers[id] = letters[clickedIdx];
      };
    });
  }

  /**
   * 打乱每个分组内的题目顺序
   */
  function shuffleQuestions() {
    saveOrder();
    var groups = getSectionGroups();
    var paper = document.querySelector('.exam-paper-inner');
    if (!paper) return;

    groups.forEach(function(group) {
      if (group.items.length <= 1) return;
      var shuffled = fisherYatesShuffle(group.items);
      // 将打乱后的题目插回到该组标题之后
      var insertPoint = group.title.nextSibling;
      shuffled.forEach(function(item) {
        paper.insertBefore(item, insertPoint);
      });
    });

    renumberQuestions();
    bindOptionClicks();
    isShuffled = true;
  }

  /**
   * 切换打乱/恢复
   */
  function toggleShuffle() {
    if (submitted) return;
    var btn = document.getElementById('shuffle-btn');
    if (!isShuffled) {
      shuffleQuestions();
      if (btn) { btn.classList.add('active'); btn.innerHTML = '&#128256; 已打乱'; }
    } else {
      restoreOrder();
      isShuffled = false;
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '&#128256; 随机排序'; }
    }
  }

  /**
   * 从当前页面 URL 推断学科代码
   * 例如 math-exam.html → math, chemistry-exam.html → chemistry
   */
  function detectSubject() {
    var path = window.location.pathname || '';
    var file = path.split('/').pop() || '';
    var match = file.match(/^(\w+)-exam/);
    if (match) return match[1];
    // 从页面标题推断
    var title = (document.title || '').toLowerCase();
    var map = {math:'数学',physics:'物理',chemistry:'化学',biology:'生物',chinese:'语文',english:'英语',politics:'政治',history:'历史',geography:'地理'};
    for (var code in map) {
      if (title.indexOf(map[code]) >= 0) return code;
    }
    return 'unknown';
  }

  /**
   * 交卷后将错题写入后端错题本
   */
  function saveWrongQuestions(wrongList) {
    var token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token || wrongList.length === 0) return;

    wrongList.forEach(function(item) {
      fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(item)
      }).catch(function(err) {
        console.warn('[ExamMode] 错题保存失败:', err.message);
      });
    });
  }

  function submit() {
    if(submitted) return;
    submitted = true;
    stopTimer();
    disableVisibilityGuard();

    var subject = detectSubject();
    var wrongList = [];
    var correct = 0, wrong = 0, blank = 0, total = 0;

    document.querySelectorAll('.question, .fill').forEach(function(q){
      var ac = q.querySelector('.answer-content');
      if(!ac) return;
      total++;
      var id = ac.id;
      var userAns = answers[id] || '';
      var correctAns = correctAnswers[id] || '';

      // 提取题号
      var qNum = id.replace(/^a/, '') || String(total);

      // 提取题目文本
      var qText = '';
      var pEl = q.querySelector('p');
      if (pEl) qText = pEl.textContent.trim();

      // 提取解析文本
      var analysis = '';
      if (ac) {
        var acClone = ac.cloneNode(true);
        // 移除答案行，保留解析
        var ansBold = acClone.querySelector('b');
        if (ansBold) ansBold.remove();
        analysis = acClone.textContent.trim().slice(0, 1000);
      }

      var badge = document.createElement('div');
      badge.className = 'result-badge';
      if(!userAns) {
        blank++;
        badge.classList.add('blank');
        badge.textContent = '-';
      } else if(userAns === correctAns) {
        correct++;
        badge.classList.add('correct');
        badge.textContent = '✓';
      } else {
        wrong++;
        badge.classList.add('wrong');
        badge.textContent = '✗';
        // 收集错题数据
        wrongList.push({
          question: qText || ('第' + qNum + '题'),
          subject: subject,
          answer: analysis,
          is_correct: false,
          user_answer: userAns,
          correct_answer: correctAns,
          exam_level: 'gaokao',
          difficulty: null,
          question_id: null,
          session_id: null
        });
      }
      q.appendChild(badge);

      if(userAns && userAns !== correctAns) {
        var opts = q.querySelectorAll('.options span');
        var letterIdx = 'ABCD'.indexOf(userAns);
        if(letterIdx >= 0 && opts[letterIdx]) {
          opts[letterIdx].style.background = '#d7192020';
          opts[letterIdx].style.color = '#d71920';
          opts[letterIdx].style.textDecoration = 'line-through';
        }
      }
    });

    document.body.classList.add('submitted');

    var scoreDiv = document.querySelector('.score-summary');
    if(!scoreDiv) {
      scoreDiv = document.createElement('div');
      scoreDiv.className = 'score-summary';
      var paper = document.querySelector('.exam-paper-inner');
      if(paper) paper.insertBefore(scoreDiv, paper.firstChild.nextSibling);
    }

    var answered = correct + wrong;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;
    var timeStr = isCountdown
      ? '限时 ' + defaultTimeLimit + ' 分钟'
      : '用时 ' + pad(Math.floor(elapsed/60)) + '分' + pad(elapsed%60) + '秒';
    scoreDiv.innerHTML = '<div class="score-num">' + correct + '/' + total + '</div>' +
      '<div class="score-label">答对 ' + correct + ' 题（' + pct + '%）· ' + timeStr + '</div>' +
      '<div class="score-detail">正确 ' + correct + ' · 错误 ' + wrong + ' · 未答 ' + blank + ' · 共 ' + total + ' 题' +
      (visibilityChangeCount > 0 ? ' · 切屏 ' + visibilityChangeCount + ' 次' : '') +
      '</div>';

    document.getElementById('submit-btn').textContent = '✅ 已交卷';

    // 构建错题面板
    buildWrongPanel(wrongList, correct, wrong, blank, total);

    window.scrollTo({top: 0, behavior: 'smooth'});

    // 异步保存错题到错题本
    if (wrongList.length > 0) {
      saveWrongQuestions(wrongList);
      console.log('[ExamMode] 已提交 ' + wrongList.length + ' 道错题到错题本');
    }
  }

  /**
   * 构建错题回顾面板
   */
  function buildWrongPanel(wrongList, correct, wrong, blank, total) {
    var existing = document.getElementById('wrong-panel');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = 'wrong-panel';
    panel.style.cssText = 'position:fixed;top:0;right:0;width:380px;max-width:90vw;height:100vh;background:var(--bg-card,#fff);border-left:1px solid var(--border,#e5e5e5);box-shadow:-4px 0 24px rgba(0,0,0,.12);z-index:9999;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s ease';

    var header = '<div style="padding:16px 20px;border-bottom:1px solid var(--border,#e5e5e5);display:flex;align-items:center;justify-content:space-between">' +
      '<div><div style="font-size:16px;font-weight:700">错题回顾</div>' +
      '<div style="font-size:12px;color:var(--text-muted,#888);margin-top:2px">答对 ' + correct + '/' + total + ' · 错误 ' + wrong + ' · 未答 ' + blank + '</div></div>' +
      '<button onclick="document.getElementById(\'wrong-panel\').style.transform=\'translateX(100%)\'" style="border:none;background:none;font-size:20px;cursor:pointer;color:var(--text-muted,#888);padding:4px 8px">&times;</button>' +
      '</div>';

    var body = '<div style="flex:1;overflow-y:auto;padding:12px 16px">';

    if (wrongList.length === 0) {
      body += '<div style="text-align:center;padding:40px 20px;color:var(--text-muted,#888)">' +
        '<div style="font-size:48px;margin-bottom:12px">&#127881;</div>' +
        '<div style="font-size:15px;font-weight:600">全部正确！</div>' +
        '<div style="font-size:13px;margin-top:4px">没有错题需要回顾</div></div>';
    } else {
      wrongList.forEach(function(item, idx) {
        var qPreview = (item.question || '').slice(0, 80);
        if ((item.question || '').length > 80) qPreview += '...';
        body += '<div style="padding:12px;border:1px solid var(--border,#e5e5e5);border-radius:8px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">' +
            '<span style="background:#d7192020;color:#d71920;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">第' + (idx+1) + '题</span>' +
            '<span style="font-size:11px;color:var(--text-muted,#888)">' + item.subject + '</span>' +
          '</div>' +
          '<div style="font-size:13px;line-height:1.5;color:var(--text,#333);margin-bottom:8px">' + qPreview + '</div>' +
          '<div style="display:flex;gap:12px;font-size:12px">' +
            '<span style="color:#d71920">你的答案: ' + (item.user_answer || '未答') + '</span>' +
            '<span style="color:#059669">正确答案: ' + item.correct_answer + '</span>' +
          '</div>';
        if (item.answer) {
          body += '<details style="margin-top:8px"><summary style="font-size:12px;color:var(--accent,#007aff);cursor:pointer;font-weight:600">查看解析</summary>' +
            '<div style="font-size:12px;line-height:1.6;color:var(--text-muted,#666);margin-top:6px;white-space:pre-wrap">' + (item.answer || '').slice(0, 500) + '</div></details>';
        }
        body += '</div>';
      });
    }
    body += '</div>';

    var footer = '<div style="padding:12px 16px;border-top:1px solid var(--border,#e5e5e5);display:flex;gap:8px">' +
      '<a href="/frontend/wrong-book.html" style="flex:1;text-align:center;padding:10px;background:var(--accent,#007aff);color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">&#128214; 查看错题本</a>' +
      '<button onclick="document.getElementById(\'wrong-panel\').style.transform=\'translateX(100%)\'" style="flex:1;padding:10px;background:var(--bg-secondary,#f5f5f5);color:var(--text,#333);border:1px solid var(--border,#e5e5e5);border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">关闭面板</button>' +
      '</div>';

    panel.innerHTML = header + body + footer;
    document.body.appendChild(panel);

    // 滑入动画
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        panel.style.transform = 'translateX(0)';
      });
    });
  }

  window._examMode = {
    switchMode: switchMode,
    submit: submit,
    toggleShuffle: toggleShuffle,
    setTimeLimit: function(minutes) {
      defaultTimeLimit = minutes || 120;
    },
    getCountdown: function() { return isCountdown; },
    getElapsedTime: function() { return elapsed; },
    getRemainingTime: function() { return remaining; },
    getVisibilityCount: function() { return visibilityChangeCount; }
  };

  document.addEventListener('DOMContentLoaded', function(){
    buildUI();
    initAnswers();
  });
})();

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
          stopTimer();
          startTimer();
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

      document.querySelectorAll('.answer-toggle').forEach(function(el){
        el.style.display = '';
      });

      document.querySelectorAll('.result-badge').forEach(function(b){ b.remove(); });
    }
  }

  function startTimer() {
    stopTimer();
    if (isCountdown) {
      remaining = defaultTimeLimit * 60;
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
      elapsed = 0;
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

  function submit() {
    if(submitted) return;
    submitted = true;
    stopTimer();
    disableVisibilityGuard();

    var correct = 0, wrong = 0, blank = 0, total = 0;

    document.querySelectorAll('.question, .fill').forEach(function(q){
      var ac = q.querySelector('.answer-content');
      if(!ac) return;
      total++;
      var id = ac.id;
      var userAns = answers[id] || '';
      var correctAns = correctAnswers[id] || '';

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
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  window._examMode = {
    switchMode: switchMode,
    submit: submit,
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

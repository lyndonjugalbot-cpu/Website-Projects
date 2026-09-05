(function(){
  "use strict";

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Nav scroll state ---------- */
  var nav = document.getElementById('nav');
  function onScroll(){
    if(window.scrollY > 20){ nav.classList.add('scrolled'); }
    else{ nav.classList.remove('scrolled'); }
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');
  navToggle.addEventListener('click', function(){
    navToggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
  });
  mobileMenu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
      navToggle.classList.remove('active');
      mobileMenu.classList.remove('active');
    });
  });

  /* ---------- Marquee: duplicate content for seamless loop ---------- */
  var track = document.getElementById('marqueeTrack');
  if(track){ track.innerHTML += track.innerHTML; }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal, .g-item, .pkg-card');
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(function(el){ io.observe(el); });

  /* ---------- Gallery filters ---------- */
  var filterBtns = document.querySelectorAll('.filter-btn');
  var galleryItems = document.querySelectorAll('#masonry .g-item');
  filterBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      filterBtns.forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      galleryItems.forEach(function(item){
        var show = (f === 'all' || item.getAttribute('data-cat') === f);
        item.style.display = show ? '' : 'none';
      });
    });
  });

  /* ---------- Lightbox ---------- */
  var lightbox = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbTag = document.getElementById('lbTag');
  var lbTitle = document.getElementById('lbTitle');
  var lbPrev = document.getElementById('lbPrev');
  var lbNext = document.getElementById('lbNext');
  var lbClose = document.getElementById('lbClose');

  function collectItems(){
    // whichever set was last opened from (gallery or packaging) becomes the nav set
    return Array.prototype.slice.call(document.querySelectorAll('.g-item, .pkg-card')).filter(function(el){
      return el.offsetParent !== null; // visible in DOM flow
    });
  }

  var activeSet = [];
  var activeIndex = 0;

  function openLightbox(el){
    activeSet = collectItems();
    activeIndex = activeSet.indexOf(el);
    renderLightbox();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function renderLightbox(){
    var el = activeSet[activeIndex];
    if(!el) return;
    lbImg.src = el.getAttribute('data-img');
    lbImg.alt = el.getAttribute('data-title') || '';
    lbTag.textContent = el.getAttribute('data-tag') || '';
    lbTitle.textContent = el.getAttribute('data-title') || '';
  }

  function closeLightbox(){
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.g-item, .pkg-card').forEach(function(el){
    el.addEventListener('click', function(){ openLightbox(el); });
  });

  lbClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e){ if(e.target === lightbox){ closeLightbox(); } });
  lbPrev.addEventListener('click', function(){
    if(!activeSet.length) return;
    activeIndex = (activeIndex - 1 + activeSet.length) % activeSet.length;
    renderLightbox();
  });
  lbNext.addEventListener('click', function(){
    if(!activeSet.length) return;
    activeIndex = (activeIndex + 1) % activeSet.length;
    renderLightbox();
  });
  document.addEventListener('keydown', function(e){
    if(!lightbox.classList.contains('active')) return;
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowLeft') lbPrev.click();
    if(e.key === 'ArrowRight') lbNext.click();
  });

  /* ---------- Video modal ---------- */
  var videoModal = document.getElementById('videoModal');
  var introVideo = document.getElementById('introVideo');
  var vmClose = document.getElementById('vmClose');
  function openVideo(){
    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    introVideo.currentTime = 0;
    introVideo.play().catch(function(){});
  }
  function closeVideo(){
    videoModal.classList.remove('active');
    document.body.style.overflow = '';
    introVideo.pause();
  }
  document.getElementById('playIntro').addEventListener('click', openVideo);
  document.getElementById('playIntroBtn').addEventListener('click', openVideo);
  vmClose.addEventListener('click', closeVideo);
  videoModal.addEventListener('click', function(e){ if(e.target === videoModal){ closeVideo(); } });

  /* ---------- Contact form -> mailto ---------- */
  var form = document.getElementById('contactForm');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name = document.getElementById('cf-name').value.trim();
    var email = document.getElementById('cf-email').value.trim();
    var type = document.getElementById('cf-type').value;
    var message = document.getElementById('cf-message').value.trim();

    var subject = 'Project Inquiry: ' + type + ' — ' + name;
    var body = 'Name: ' + name + '\nEmail: ' + email + '\nProject Type: ' + type + '\n\n' + message;

    var mailto = 'mailto:lyndon.jugalbot@gmail.com'
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(body);

    window.location.href = mailto;
  });

})();

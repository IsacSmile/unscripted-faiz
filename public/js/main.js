document.addEventListener('DOMContentLoaded', () => {

  /* =========================================
     THEME TOGGLE
  ========================================= */
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const root = document.documentElement;
      const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      if (typeof updateMidnightMode === 'function') {
        updateMidnightMode();
      }
    });
  }

  /* =========================================
     AUTO-HIDE SITE HEADER ON SCROLL
  ========================================= */
  const siteHeader = document.getElementById('site-header');
  if (siteHeader) {
    let lastScrollY = window.scrollY;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > 120) {
            siteHeader.style.transform = currentScrollY > lastScrollY ? 'translateY(-100%)' : 'translateY(0)';
          } else {
            siteHeader.style.transform = 'translateY(0)';
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* =========================================
     HAMBURGER MOBILE MENU (Drawer & Backdrop)
  ========================================= */
  const hamburger = document.getElementById('hamburger-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileClose = document.getElementById('mobile-nav-close');
  const mobileBackdrop = document.getElementById('mobile-nav-backdrop');
  const mobileThemeToggle = document.getElementById('theme-toggle-mobile');

  function openMobileMenu() {
    if (mobileNav) mobileNav.classList.add('is-open');
    if (mobileBackdrop) mobileBackdrop.classList.add('is-open');
    document.body.classList.add('mobile-menu-open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeMobileMenu() {
    if (mobileNav) mobileNav.classList.remove('is-open');
    if (mobileBackdrop) mobileBackdrop.classList.remove('is-open');
    document.body.classList.remove('mobile-menu-open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (mobileNav && mobileNav.classList.contains('is-open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (mobileClose) {
    mobileClose.addEventListener('click', closeMobileMenu);
  }

  if (mobileBackdrop) {
    mobileBackdrop.addEventListener('click', closeMobileMenu);
  }

  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', () => {
      // Simulate click on main theme toggle
      const desktopToggle = document.getElementById('theme-toggle');
      if (desktopToggle) {
        desktopToggle.click();
      }
    });
  }

  /* =========================================
     HORIZONTAL DRAG-TO-SCROLL (category grids)
  ========================================= */
  document.querySelectorAll('.category-grid').forEach(el => {
    let isDown = false, startX, scrollLeft, velX = 0, momentumID;

    el.addEventListener('mousedown', e => {
      isDown = true;
      el.classList.add('active');
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      velX = 0;
      cancelAnimationFrame(momentumID);
    });

    const end = () => {
      if (!isDown) return;
      isDown = false;
      el.classList.remove('active');
      (function step() {
        el.scrollLeft += velX;
        velX *= 0.9;
        if (Math.abs(velX) > 0.5) momentumID = requestAnimationFrame(step);
      })();
    };

    el.addEventListener('mouseleave', end);
    el.addEventListener('mouseup', end);
    el.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const prev = el.scrollLeft;
      el.scrollLeft = scrollLeft - (x - startX) * 1.5;
      velX = el.scrollLeft - prev;
    });
  });

  /* =========================================
     LIVE SEARCH & LOAD MORE PAGINATION (UNIFIED)
  ========================================= */
  const searchField = document.getElementById('live-search-input');
  const postGrid = document.getElementById('post-grid');
  const infoStripCount = document.getElementById('info-strip-count');
  const infoStripText  = document.getElementById('info-strip-text');
  const noResults = document.getElementById('no-results');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let currentPage = 1;
  let debounceTimer;

  function catClass(slug) {
    const map = { tech:'category-tag-tech', world:'category-tag-world', college:'category-tag-college', personal:'category-tag-personal', gazal:'category-tag-gazal' };
    return map[slug] || 'category-tag-default';
  }

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  }

  const calSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
  const eyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

  function showSkeletons() {
    postGrid.innerHTML = Array.from({length: 6}).map(() => `
      <div class="post-card skeleton-card">
        <div class="skeleton-img skeleton"></div>
        <div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem;">
          <div class="skeleton-text skeleton" style="width:40%;height:.7rem;"></div>
          <div class="skeleton-text skeleton"></div>
          <div class="skeleton-text short skeleton"></div>
        </div>
      </div>
    `).join('');
  }

  function createPostHTML(post) {
    return `
      <article class="post-card">
        <div class="post-card-img-wrapper">
          <a href="/blog/${post.slug}">
            <img src="${post.cover_image || post.category_image || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80'}"
                 alt="${post.title}" class="post-card-img" loading="lazy"
                 onerror="this.src='${post.category_image || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80'}'">
          </a>
        </div>
        <div class="post-card-content">
          <span class="post-card-category ${catClass(post.category)}">${post.category}</span>
          <h3 class="post-card-title"><a href="/blog/${post.slug}">${post.title}</a></h3>
          <p class="post-card-desc">${post.description || ''}</p>
          <div class="post-card-footer">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span class="post-card-date" style="display:inline-flex; align-items:center; gap:0.25rem;">${calSvg} ${fmtDate(post.published_at)}</span>
              <span class="post-card-date" style="display:inline-flex; align-items:center; gap:0.25rem;">${eyeSvg} ${post.view_count || 0}</span>
            </div>
            <button class="share-btn" data-url="/blog/${post.slug}" data-title="${post.title}" aria-label="Share">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  async function doSearch(q) {
    currentPage = 1;
    showSkeletons();
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    const currentCategory = new URLSearchParams(location.search).get('category') || '';
    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(currentCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (infoStripCount) infoStripCount.textContent = data.total;
      if (infoStripText) infoStripText.textContent = data.total === 1 ? 'post' : 'posts';
      
      if (data.posts.length === 0) {
        postGrid.innerHTML = '';
        if (noResults) noResults.hidden = false;
        return;
      }
      if (noResults) noResults.hidden = true;
      postGrid.innerHTML = data.posts.map(createPostHTML).join('');
      observeCards();

      if (data.posts.length >= 18 && loadMoreBtn) {
        loadMoreBtn.style.display = '';
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (searchField && postGrid) {
    searchField.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doSearch(searchField.value.trim()), 280);
    });
  }

  if (loadMoreBtn && postGrid) {
    loadMoreBtn.addEventListener('click', async () => {
      currentPage++;
      const skeletons = Array.from({length: 6}).map(() => {
        const d = document.createElement('div');
        d.className = 'post-card skeleton-card';
        d.innerHTML = `<div class="skeleton-img skeleton"></div><div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem;"><div class="skeleton-text skeleton" style="width:40%;height:.7rem;"></div><div class="skeleton-text skeleton"></div></div>`;
        postGrid.appendChild(d);
        return d;
      });
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading…';

      const urlParams = new URLSearchParams(window.location.search);
      const category = urlParams.get('category') || '';
      const q = searchField ? searchField.value.trim() : (urlParams.get('q') || '');

      try {
        const res = await fetch(`/api/posts?page=${currentPage}&category=${encodeURIComponent(category)}&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        skeletons.forEach(s => {
          s.style.transition = 'opacity .2s';
          s.style.opacity = '0';
          setTimeout(() => s.remove(), 220);
        });

        data.posts.forEach(post => {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = createPostHTML(post);
          const article = tempDiv.firstElementChild;
          postGrid.appendChild(article);
          cardObserver.observe(article);
        });

        if (data.posts.length < 18) {
          loadMoreBtn.style.display = 'none';
        } else {
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = 'Load More';
        }
      } catch (e) {
        console.error(e);
        skeletons.forEach(s => s.remove());
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More';
      }
    });
  }

  /* =========================================
     POST CARD ENTRANCE ANIMATION (Intersection Observer)
  ========================================= */
  const cardObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 50px 0px 50px'
  });

  function observeCards() {
    document.querySelectorAll('.post-card:not(.skeleton-card)').forEach(card => {
      cardObserver.observe(card);
    });
  }

  // Initial animation trigger
  observeCards();

  /* =========================================
     SHARE FUNCTIONALITY (Centered Modal Dialog)
  ========================================= */
  const shareModal = document.getElementById('share-modal');
  const shareBackdrop = document.getElementById('share-modal-backdrop');
  const shareClose = document.getElementById('share-modal-close');
  let _shareUrl = '', _shareTitle = '';

  function openShareModal(url, title) {
    const absUrl = location.origin + url;
    _shareUrl = absUrl;
    _shareTitle = title;

    if (shareModal && shareBackdrop) {
      shareModal.classList.add('is-open');
      shareBackdrop.classList.add('is-open');
    }
  }

  function closeShareModal() {
    if (shareModal && shareBackdrop) {
      shareModal.classList.remove('is-open');
      shareBackdrop.classList.remove('is-open');
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.share-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      openShareModal(btn.dataset.url, btn.dataset.title);
    }
  });

  if (shareClose) {
    shareClose.addEventListener('click', closeShareModal);
  }

  if (shareBackdrop) {
    shareBackdrop.addEventListener('click', closeShareModal);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeShareModal();
    }
  });

  document.getElementById('share-opt-twitter')?.addEventListener('click', () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(_shareUrl)}&text=${encodeURIComponent(_shareTitle)}`, '_blank');
    closeShareModal();
  });

  document.getElementById('share-opt-whatsapp')?.addEventListener('click', () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(_shareTitle + ' ' + _shareUrl)}`, '_blank');
    closeShareModal();
  });

  document.getElementById('share-opt-copy')?.addEventListener('click', async () => {
    const copyText = document.getElementById('share-copy-text');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(_shareUrl);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = _shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      if (copyText) {
        copyText.textContent = '✓ Copied!';
      }
      setTimeout(() => {
        if (copyText) {
          copyText.textContent = 'Copy Link';
        }
        closeShareModal();
      }, 1000);
    } catch (e) {
      console.error('Failed to copy text', e);
      closeShareModal();
    }
  });

  /* =========================================
     GLOBAL PERSISTENT AMBIENT MUSIC PLAYER
  ========================================= */
  const audioUrl = window.APP_CONFIG?.ambientMusicSrc || 'https://framerusercontent.com/assets/s6Kcvm0lGpVdIimLMjrCJjPgd28.mp3';
  const audioType = window.APP_CONFIG?.ambientMusicType || 'file';
  const musicToggles = document.querySelectorAll('#ambient-music-btn, #header-music-btn, #music-toggle-mobile');

  if (musicToggles.length > 0) {
    let audio = null;
    let ytPlayer = null;
    let fadeInterval = null;
    let currentVolume = 0;
    const targetVolume = 0.35; // comfortable, non-jarring volume

    function getYouTubeId(url) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    }

    function updateVisuals(isPlaying) {
      musicToggles.forEach(toggle => {
        if (isPlaying) {
          toggle.classList.add('playing');
          toggle.setAttribute('aria-label', 'Stop ambient music');
          toggle.setAttribute('title', 'Stop ambient music');
          const label = toggle.querySelector('.music-toggle-mobile-label');
          if (label) label.textContent = 'Mute Ambient Music';
        } else {
          toggle.classList.remove('playing');
          toggle.setAttribute('aria-label', 'Play ambient music');
          toggle.setAttribute('title', 'Play ambient music');
          const label = toggle.querySelector('.music-toggle-mobile-label');
          if (label) label.textContent = 'Play Ambient Music';
        }
      });
    }

    function playMusic() {
      if (audioType === 'youtube' && ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.playVideo();
      } else if (audio) {
        audio.play().catch(e => {
          console.warn('HTML5 audio play blocked:', e);
          setupAutoplayBypass();
        });
      }
    }

    function pauseMusic() {
      if (audioType === 'youtube' && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        ytPlayer.pauseVideo();
      } else if (audio) {
        audio.pause();
      }
    }

    function setPlayerVolume(vol) {
      currentVolume = vol;
      if (audioType === 'youtube' && ytPlayer && typeof ytPlayer.setVolume === 'function') {
        ytPlayer.setVolume(vol * 100);
      } else if (audio) {
        audio.volume = vol;
      }
    }

    function getPlayerCurrentTime() {
      if (audioType === 'youtube' && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
        return ytPlayer.getCurrentTime();
      } else if (audio) {
        return audio.currentTime;
      }
      return 0;
    }

    function isPlayerPaused() {
      if (audioType === 'youtube' && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
        return ytPlayer.getPlayerState() !== 1; // 1 is playing
      } else if (audio) {
        return audio.paused;
      }
      return true;
    }

    function playAndFadeIn() {
      clearInterval(fadeInterval);
      playMusic();
      
      fadeInterval = setInterval(() => {
        if (currentVolume < targetVolume - 0.02) {
          setPlayerVolume(currentVolume + 0.02);
        } else {
          setPlayerVolume(targetVolume);
          clearInterval(fadeInterval);
        }
      }, 30);
    }

    function fadeOut() {
      clearInterval(fadeInterval);
      fadeInterval = setInterval(() => {
        if (currentVolume > 0.02) {
          setPlayerVolume(currentVolume - 0.02);
        } else {
          setPlayerVolume(0);
          pauseMusic();
          clearInterval(fadeInterval);
        }
      }, 30);
    }

    function setupAutoplayBypass() {
      const resumeAudio = () => {
        playAndFadeIn();
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('touchstart', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
        document.removeEventListener('scroll', resumeAudio);
      };
      document.addEventListener('click', resumeAudio);
      document.addEventListener('touchstart', resumeAudio);
      document.addEventListener('keydown', resumeAudio);
      document.addEventListener('scroll', resumeAudio);
    }

    function initYouTubePlayer(videoId) {
      let container = document.getElementById('yt-audio-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'yt-audio-container';
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '0';
        container.style.height = '0';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
      }
      
      let playerDiv = document.createElement('div');
      playerDiv.id = 'yt-player';
      container.appendChild(playerDiv);

      ytPlayer = new YT.Player('yt-player', {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          loop: 1,
          playlist: videoId
        },
        events: {
          onReady: (event) => {
            event.target.setVolume(0);
            const savedPlaying = localStorage.getItem('ambient-music-playing') === 'true';
            if (savedPlaying) {
              const savedTime = parseFloat(localStorage.getItem('ambient-music-time') || 0);
              event.target.seekTo(savedTime, true);
              updateVisuals(true);
              playAndFadeIn();
            } else {
              updateVisuals(false);
            }
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
          }
        }
      });
    }

    // Toggle button click logic
    musicToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentlyPlaying = localStorage.getItem('ambient-music-playing') === 'true';
        if (currentlyPlaying) {
          localStorage.setItem('ambient-music-playing', 'false');
          updateVisuals(false);
          fadeOut();
        } else {
          localStorage.setItem('ambient-music-playing', 'true');
          updateVisuals(true);
          playAndFadeIn();
        }
      });
    });

    // Loop to continuously save time
    setInterval(() => {
      if (localStorage.getItem('ambient-music-playing') === 'true' && !isPlayerPaused()) {
        localStorage.setItem('ambient-music-time', getPlayerCurrentTime());
      }
    }, 1000);

    // Initialize player depending on type
    if (audioType === 'youtube') {
      const videoId = getYouTubeId(audioUrl);
      if (videoId) {
        if (!window.YT) {
          const tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          
          window.onYouTubeIframeAPIReady = () => {
            initYouTubePlayer(videoId);
          };
        } else {
          initYouTubePlayer(videoId);
        }
      }
    } else {
      // Direct file source
      audio = new Audio(audioUrl);
      audio.loop = true;
      audio.volume = 0;
      
      const savedPlaying = localStorage.getItem('ambient-music-playing') === 'true';
      if (savedPlaying) {
        const savedTime = parseFloat(localStorage.getItem('ambient-music-time') || 0);
        audio.currentTime = savedTime;
        updateVisuals(true);
        playAndFadeIn();
      } else {
        updateVisuals(false);
      }
    }
  }

  /* ── MIDNIGHT MODE CONTINUOUS TIMER ── */
  function updateMidnightMode() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const hrs = new Date().getHours();
    const isMidnight = (hrs >= 22 || hrs < 6) && currentTheme === 'dark';
    const badge = document.getElementById('midnight-badge');
    
    if (isMidnight) {
      root.setAttribute('data-midnight', 'true');
      if (badge) badge.style.display = 'inline-flex';
    } else {
      root.removeAttribute('data-midnight');
      if (badge) badge.style.display = 'none';
    }
  }
  updateMidnightMode();
  setInterval(updateMidnightMode, 60000);

  /* ── READING PROGRESS INDICATOR ── */
  const progressBar = document.getElementById('reading-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      progressBar.style.width = scrolled + '%';
    }, { passive: true });
  }

  /* ── STICKY TABLE OF CONTENTS ── */
  const postContent = document.getElementById('single-post-content');
  const tocNav = document.getElementById('post-toc');
  const sidebar = document.getElementById('post-sidebar');
  const mobileToggle = document.getElementById('mobile-toc-toggle');
  const mobileTocClose = document.getElementById('mobile-toc-close');
  
  if (postContent && tocNav) {
    const headings = postContent.querySelectorAll('h2, h3');
    
    if (headings.length >= 2) {
      const ul = document.createElement('ul');
      headings.forEach((heading, idx) => {
        if (!heading.id) {
          heading.id = 'heading-' + idx;
        }
        
        const li = document.createElement('li');
        li.className = 'toc-depth-' + heading.tagName.toLowerCase();
        
        const a = document.createElement('a');
        a.href = '#' + heading.id;
        a.textContent = heading.textContent;
        
        a.addEventListener('click', (e) => {
          e.preventDefault();
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (sidebar) sidebar.classList.remove('open');
        });
        
        li.appendChild(a);
        ul.appendChild(li);
      });
      tocNav.appendChild(ul);
      
      const tocLinks = tocNav.querySelectorAll('a');
      const observerOptions = {
        root: null,
        rootMargin: '0px 0px -60% 0px',
        threshold: 0
      };
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocLinks.forEach((link) => {
              if (link.getAttribute('href') === '#' + id) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        });
      }, observerOptions);
      
      headings.forEach((heading) => observer.observe(heading));
    } else {
      const layoutWrapper = document.querySelector('.post-layout-wrapper');
      if (layoutWrapper) {
        layoutWrapper.classList.add('no-toc');
      }
      const tocContainer = document.getElementById('post-toc-container');
      if (tocContainer) tocContainer.style.display = 'none';
      if (mobileToggle) mobileToggle.style.display = 'none';
    }
    
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.add('open');
      });
    }
    if (mobileTocClose && sidebar) {
      mobileTocClose.addEventListener('click', () => {
        sidebar.classList.remove('open');
      });
    }
    document.addEventListener('click', (e) => {
      if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== mobileToggle) {
        sidebar.classList.remove('open');
      }
    });
  }

  /* ── COMMENTS CHARACTER LIMIT & COUNTER ── */
  const commentTextarea = document.getElementById('comment-textarea');
  const charCounter = document.getElementById('comment-char-counter');
  const commentForm = document.getElementById('comment-form');
  
  if (commentTextarea && charCounter) {
    const maxLength = parseInt(commentTextarea.getAttribute('maxlength') || 500, 10);
    
    function updateCharCount() {
      const len = commentTextarea.value.length;
      charCounter.textContent = `${len} / ${maxLength}`;
      
      if (len >= maxLength) {
        charCounter.className = 'comment-char-counter at-limit';
      } else if (len >= maxLength - 50) {
        charCounter.className = 'comment-char-counter near-limit';
      } else {
        charCounter.className = 'comment-char-counter';
      }
    }
    
    commentTextarea.addEventListener('input', updateCharCount);
    updateCharCount();
    
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        if (commentTextarea.value.length > maxLength) {
          e.preventDefault();
          alert(`Comment cannot exceed ${maxLength} characters.`);
        }
      });
    }
  }

});

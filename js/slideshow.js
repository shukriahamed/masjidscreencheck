/**
 * slideshow.js
 * Manages Hadith/Quran slides and Announcement slides with smooth cross-fade transitions.
 */

const Slideshow = (() => {
  let slides        = [];
  let announcements = [];
  let currentIndex  = 0;
  let sayingIndex   = 0;     // which Hadith / Quran saying the next round uses
  let roundQueue    = [];    // slides still to show in the current round
  let slideTimer    = null;
  let isTransitioning = false;

  const TYPE_ICONS = {
    hadith:      '📖',
    quran:       '📿',
    reminder:    '🔔',
    dua:         '🤲',
    educational: '🎓',
    announcement:'📢',
  };

  // ── Default seed data ───────────────────────────────────────────────
  const DEFAULT_SLIDES = [
    {
      id: 'default-basmala',
      type: 'quran', enabled: true, order: 0, duration: 7000,
      arabic: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
      translation: 'In the name of Allah, the Most Gracious, the Most Merciful.',
      translationTamil: 'அளவற்ற அருளாளனும் நிகரற்ற அன்புடையோனுமான அல்லாஹ்வின் திருப்பெயரால்.',
      source: 'Quran — Basmala (Opening of every chapter)',
      bgColor: 'rgba(10,30,60,0.92)',
    },
    {
      id: 'default-hadith-niyyah',
      type: 'hadith', enabled: true, order: 1, duration: 9000,
      arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
      translation: 'Actions are judged by intentions, and every person will get what they intended.',
      translationTamil: 'செயல்கள் நோக்கங்களால் தீர்மானிக்கப்படுகின்றன; ஒவ்வொருவருக்கும் அவர் நோக்கியதே கிடைக்கும்.',
      source: 'Sahih al-Bukhari, Hadith 1 — Narrated by Umar ibn al-Khattab (RA)',
      bgColor: 'rgba(20,10,50,0.92)',
    },
    {
      id: 'default-quran-taqwa',
      type: 'quran', enabled: true, order: 2, duration: 9000,
      arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ',
      translation: 'Whoever fears Allah — He will make a way out for him, and provide for him from where he least expects.',
      translationTamil: 'அல்லாஹ்வை யார் அஞ்சுகிறாரோ, அவருக்கு அவன் ஒரு வழியை உண்டாக்குவான்; எங்கிருந்து எதிர்பார்க்காதோ அங்கிருந்து அவருக்கு உணவளிப்பான்.',
      source: 'Quran 65:2–3',
      bgColor: 'rgba(10,30,10,0.92)',
    },
    {
      id: 'default-reminder-phone',
      type: 'reminder', enabled: true, order: 3, duration: 6000,
      arabic: '',
      translation: 'Please switch your mobile phones to silent mode during prayer times.',
      translationTamil: 'தொழுகை நேரங்களில் உங்கள் மொபைல் போன்களை சைலண்ட் மோடில் வையுங்கள்.',
      source: 'Mosque Notice — Masjidur Rahman',
      bgColor: 'rgba(10,20,40,0.92)',
    },
    {
      id: 'default-hadith-smile',
      type: 'hadith', enabled: true, order: 4, duration: 8000,
      arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ',
      translation: 'Your smile for your brother is a form of charity (Sadaqah).',
      translationTamil: 'உங்கள் சகோதரருக்கு நீங்கள் புன்னகைப்பது தர்மம் (ஸதக்கா) ஆகும்.',
      source: 'Sahih al-Tirmidhi, Hadith 1956 — Narrated by Abu Dharr (RA)',
      bgColor: 'rgba(30,15,0,0.92)',
    },
  ];


  // More built-in slides so the home screen keeps rotating through fresh content.
  const MORE_SLIDES = [
    { id:'d-h-merciful', type:'hadith', duration:9000, arabic:'الرَّاحِمُونَ يَرْحَمُهُمُ الرَّحْمَنُ', translation:'The merciful are shown mercy by the Most Merciful. Be merciful to those on earth, and the One in heaven will be merciful to you.', translationTamil:'இரக்கமுள்ளவர்களுக்கு அளவற்ற அருளாளன் இரக்கம் காட்டுவான். பூமியிலுள்ளோருக்கு இரங்குங்கள்; வானிலுள்ளவன் உங்களுக்கு இரங்குவான்.', source:'Sunan Abi Dawud 4941, Tirmidhi 1924' },
    { id:'d-h-easy', type:'hadith', duration:9000, arabic:'يَسِّرُوا وَلَا تُعَسِّرُوا وَبَشِّرُوا وَلَا تُنَفِّرُوا', translation:'Make things easy and do not make them difficult; give glad tidings and do not drive people away.', translationTamil:'எளிதாக்குங்கள், சிரமப்படுத்தாதீர்கள்; நற்செய்தி கூறுங்கள், வெறுப்பூட்டாதீர்கள்.', source:'Sahih al-Bukhari 69 — Narrated by Anas (RA)' },
    { id:'d-h-best', type:'hadith', duration:9000, arabic:'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', translation:'The best among you are those who learn the Quran and teach it.', translationTamil:'உங்களில் சிறந்தவர், குர்ஆனைக் கற்று பிறருக்குக் கற்றுக் கொடுப்பவரே.', source:'Sahih al-Bukhari 5027 — Narrated by Uthman (RA)' },
    { id:'d-h-clean', type:'hadith', duration:8000, arabic:'الطُّهُورُ شَطْرُ الإِيمَانِ', translation:'Cleanliness is half of faith.', translationTamil:'தூய்மை ஈமானின் பாதியாகும்.', source:'Sahih Muslim 223 — Narrated by Abu Malik al-Ash\'ari (RA)' },
    { id:'d-h-silent', type:'hadith', duration:9000, arabic:'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', translation:'Whoever believes in Allah and the Last Day, let him speak good or remain silent.', translationTamil:'அல்லாஹ்வையும் இறுதிநாளையும் நம்புபவர் நல்லதைப் பேசட்டும்; அல்லது மௌனமாக இருக்கட்டும்.', source:'Sahih al-Bukhari 6018, Sahih Muslim 47' },
    { id:'d-h-brother', type:'hadith', duration:9000, arabic:'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', translation:'None of you truly believes until he loves for his brother what he loves for himself.', translationTamil:'தனக்கு விரும்புவதை தன் சகோதரருக்கும் விரும்பாத வரை உங்களில் யாரும் முழுமையாக நம்பிக்கை கொண்டவராகமாட்டார்.', source:'Sahih al-Bukhari 13, Sahih Muslim 45' },
    { id:'d-q-ease', type:'quran', duration:9000, arabic:'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا', translation:'Indeed, with hardship comes ease. Indeed, with hardship comes ease.', translationTamil:'நிச்சயமாக கஷ்டத்துடன் இலகு உண்டு. நிச்சயமாக கஷ்டத்துடன் இலகு உண்டு.', source:'Quran 94:5–6' },
    { id:'d-q-remember', type:'quran', duration:9000, arabic:'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', translation:'Verily, in the remembrance of Allah do hearts find rest.', translationTamil:'அறிந்து கொள்ளுங்கள்! அல்லாஹ்வின் நினைவினாலேயே உள்ளங்கள் நிம்மதி அடைகின்றன.', source:'Quran 13:28' },
    { id:'d-q-kursi', type:'quran', duration:10000, arabic:'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ', translation:'Allah — there is no deity except Him, the Ever-Living, the Sustainer of all existence.', translationTamil:'அல்லாஹ் — அவனையன்றி வணக்கத்திற்குரியவன் வேறு இல்லை; என்றும் உயிருள்ளவன், அனைத்தையும் நிர்வகிப்பவன்.', source:'Quran 2:255 (Ayat al-Kursi)' },
    { id:'d-q-thank', type:'quran', duration:9000, arabic:'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', translation:'If you are grateful, I will surely increase you [in favour].', translationTamil:'நீங்கள் நன்றி செலுத்தினால் நிச்சயமாக உங்களுக்கு (அருளை) அதிகப்படுத்துவேன்.', source:'Quran 14:7' },
    { id:'d-dua-knowledge', type:'dua', duration:8000, arabic:'رَبِّ زِدْنِي عِلْمًا', translation:'My Lord, increase me in knowledge.', translationTamil:'என் இறைவனே! எனக்கு கல்வி ஞானத்தை அதிகப்படுத்துவாயாக.', source:'Dua — Quran 20:114' },
    { id:'d-dua-both', type:'dua', duration:9000, arabic:'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', translation:'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.', translationTamil:'எங்கள் இறைவா! இவ்வுலகிலும் நன்மையைத் தருவாயாக; மறுமையிலும் நன்மையைத் தருவாயாக; நரக வேதனையிலிருந்து எங்களைக் காப்பாயாக.', source:'Dua — Quran 2:201' },
    { id:'d-rem-shoes', type:'reminder', duration:6000, arabic:'', translation:'Please keep the mosque clean and place your shoes neatly on the racks.', translationTamil:'பள்ளிவாசலைச் சுத்தமாக வைத்திருங்கள்; காலணிகளை ரேக்கில் ஒழுங்காக வையுங்கள்.', source:'Mosque Notice — Masjidur Rahman' },
    { id:'d-rem-straight', type:'reminder', duration:6000, arabic:'', translation:'Fill the front rows first and stand shoulder to shoulder, straightening the rows.', translationTamil:'முதல் வரிசைகளை நிரப்புங்கள்; தோளோடு தோள் சேர்ந்து வரிசைகளை நேராக்குங்கள்.', source:'Mosque Notice — Masjidur Rahman' },
  ];
  MORE_SLIDES.forEach((s, i) => { s.enabled = true; s.order = 10 + i; });
  const ALL_DEFAULTS = () => DEFAULT_SLIDES.concat(MORE_SLIDES);

  // ── Load data from IndexedDB ────────────────────────────────────────
  async function loadData() {
    slides        = await Storage.getAllSlides();
    announcements = await Storage.getAllAnnouncements();

    // Seed defaults if no slides exist yet; once, top up with the extra built-ins
    if (slides.length === 0) {
      for (const s of ALL_DEFAULTS()) await Storage.saveSlide(s);
      slides = ALL_DEFAULTS();
      try { localStorage.setItem('masjid-slides-seeded', '2'); } catch (e) {}
    } else {
      let seeded = null;
      try { seeded = localStorage.getItem('masjid-slides-seeded'); } catch (e) {}
      if (seeded !== '2') {
        const have = new Set(slides.map(x => x.id));
        for (const s of MORE_SLIDES) if (!have.has(s.id)) await Storage.saveSlide(s);
        try { localStorage.setItem('masjid-slides-seeded', '2'); } catch (e) {}
        slides = await Storage.getAllSlides();
      }
    }
  }

  // ── Build the active slide list ─────────────────────────────────────
  function getActiveSlides() {
    const now    = Date.now();
    const result = [];

    // Add enabled hadith/quran/reminder slides
    for (const s of slides) {
      if (s.enabled !== false) result.push({ ...s, _kind: 'content' });
    }

    // Add active announcements
    for (const a of announcements) {
      if (a.enabled === false) continue;
      if (a.startDate  && new Date(a.startDate)  > new Date()) continue;
      if (a.expiryDate && new Date(a.expiryDate) < new Date()) continue;
      result.push({ ...a, _kind: 'announcement' });
    }

    // Sort: priority desc, then order asc
    result.sort((a, b) => ((b.priority || 0) - (a.priority || 0)) || ((a.order || 0) - (b.order || 0)));
    // Digital clock slide: comes first, right after the mosque photo
    if (Storage.getSettings().digitalSlideEnabled !== false) {
      result.unshift({ id: '_digital-clock', _kind: 'clock', duration: 9000 });
    }
    return result;
  }

  // ── One round of the slideshow ───────────────────────────────────────
  // Every round = digital clock → next prayer (Athan + Iqamah) → ONE Hadith /
  // Quran saying. The saying moves on to the next one each round. Active
  // announcements, if any, are added at the end of the round.
  const SAYING_TYPES = ['hadith', 'quran', 'dua'];
  function buildRound() {
    const st = Storage.getSettings();
    const q = [];
    if (st.digitalSlideEnabled !== false) q.push({ id: '_digital-clock', _kind: 'clock', duration: 9000 });
    if (st.nextPrayerSlideEnabled !== false) q.push({ id: '_next-prayer', _kind: 'next', duration: 9000 });

    const pool = slides
      .filter(x => x.enabled !== false && SAYING_TYPES.includes(x.type))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    if (pool.length) {
      q.push({ ...pool[sayingIndex % pool.length], _kind: 'content' });
      sayingIndex++;
    }

    const now = new Date();
    for (const a of announcements) {
      if (a.enabled === false) continue;
      if (a.startDate  && new Date(a.startDate)  > now) continue;
      if (a.expiryDate && new Date(a.expiryDate) < now) continue;
      q.push({ ...a, _kind: 'announcement' });
    }
    return q;
  }

  // ── Next prayer slide: Athan + Iqamah times and a live countdown ─────
  const toSecs = (t) => {
    if (!t || t === '--:--') return null;
    const [h, m] = t.split(':').map(Number);
    return isNaN(h) || isNaN(m) ? null : h * 3600 + m * 60;
  };
  function fmtClock(t, fmt) {
    const secs = toSecs(t);
    if (secs === null) return { t: '--:--', ap: '' };
    const h = Math.floor(secs / 3600), m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    if (fmt === '24h') return { t: String(h).padStart(2, '0') + ':' + m, ap: '' };
    return { t: (h % 12 || 12) + ':' + m, ap: h >= 12 ? 'PM' : 'AM' };
  }
  function hms(sec) {
    sec = Math.max(0, Math.round(sec));
    const p = n => String(n).padStart(2, '0');
    return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec % 3600 / 60))}:${p(sec % 60)}`;
  }
  /** The prayer that matters right now: next Athan, or — once its Athan is
   *  over — the Iqamah still to come. (Sunrise is not a prayer.) */
  function relevantPrayer(now) {
    const list = ((typeof App !== 'undefined' && App.getPrayers && App.getPrayers()) || [])
      .filter(p => p.enabled && p.id !== 'sunrise' && toSecs(p.athan) !== null);
    if (!list.length) return null;
    const nowS = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    for (const p of list) {
      const A = toSecs(p.athan), I = toSecs(p.iqamah);
      if (nowS < A) return { p, mode: 'athan', left: A - nowS };
      if (I !== null && I > A && nowS < I) return { p, mode: 'iqamah', left: I - nowS };
    }
    const f = list[0];                                  // after Isha: tomorrow's first prayer
    return { p: f, mode: 'athan', left: toSecs(f.athan) + 86400 - nowS };
  }

  function buildNextPrayerSlide(el) {
    el.classList.add('slide-nextp');
    el.innerHTML = `
      <div class="slide-content nextp-slide">
        <div class="np-label"></div>
        <div class="np-name"><span class="np-en gold-text"></span><span class="np-ar"></span></div>
        <div class="np-times">
          <div class="np-box np-athan"><div class="np-cap">ATHAN</div><div class="np-val"></div></div>
          <div class="np-diamond">◆</div>
          <div class="np-box np-iqamah"><div class="np-cap">IQAMAH</div><div class="np-val"></div></div>
        </div>
        <div class="np-count"></div>
      </div>`;
    const q = c => el.querySelector(c);
    const val = (t, fmt) => { const x = fmtClock(t, fmt); return `${x.t}${x.ap ? `<small>${x.ap}</small>` : ''}`; };
    let shownFor = null;
    const upd = () => {
      const st = Storage.getSettings(), r = relevantPrayer(new Date());
      if (!r) { q('.np-label').textContent = ''; return; }
      const key = r.p.id + r.mode + r.p.athan + r.p.iqamah;
      if (key !== shownFor) {
        shownFor = key;
        q('.np-label').textContent = r.p.isJummah ? 'NEXT PRAYER · FRIDAY' : 'NEXT PRAYER';
        q('.np-en').textContent = (r.p.name || '').toUpperCase();
        q('.np-ar').textContent = r.p.arabicName || '';
        q('.np-athan .np-val').innerHTML = val(r.p.athan, st.timeFormat);
        q('.np-iqamah .np-val').innerHTML = r.p.iqamah ? val(r.p.iqamah, st.timeFormat) : '—';
        q('.np-athan').classList.toggle('on', r.mode === 'athan');
        q('.np-iqamah').classList.toggle('on', r.mode === 'iqamah');
      }
      q('.np-count').textContent = (r.mode === 'athan' ? 'Athan in ' : 'Iqamah in ') + hms(r.left);
    };
    upd();
    el._tick = setInterval(upd, 1000);
  }

  // ── Digital clock slide ─────────────────────────────────────────────
  function buildClockSlide(el) {
    el.classList.add('slide-clock');
    el.innerHTML = `
      <div class="slide-content clock-slide">
        <div class="cs-time"><span class="cs-hm"></span><span class="cs-sec"></span><span class="cs-ampm"></span></div>
        <div class="cs-date"></div>
        <div class="cs-hijri"></div>
        <div class="cs-next"></div>
      </div>`;
    const q = c => el.querySelector(c);
    const upd = () => {
      const d = new Date(), st = Storage.getSettings();
      const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
      const is24 = st.timeFormat === '24h' || st.clockFormat === '24h';
      q('.cs-hm').textContent = (is24 ? String(h).padStart(2, '0') : (h % 12 || 12)) + ':' + m;
      q('.cs-sec').textContent = String(d.getSeconds()).padStart(2, '0');
      q('.cs-ampm').textContent = is24 ? '' : (h >= 12 ? 'PM' : 'AM');
      q('.cs-date').textContent = `${Clock.GREG_DAYS[d.getDay()]}, ${Clock.GREG_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
      q('.cs-hijri').textContent = Clock.hijriString(d, st.hijriOffset);
      const r = relevantPrayer(d);
      q('.cs-next').textContent = r ? `${r.p.name} ${r.mode === 'athan' ? 'Athan' : 'Iqamah'} in ${hms(r.left)}` : '';
    };
    upd();
    el._tick = setInterval(upd, 1000);
  }

  // ── Build slide DOM element ─────────────────────────────────────────
  async function buildSlideEl(slide) {
    const el = document.createElement('div');
    el.className = 'slide-item slide-' + (slide._kind === 'clock' ? 'clockk' : slide._kind === 'next' ? 'nextp' : (slide.type || 'announcement'));

    if (slide.bgColor) el.style.background = slide.bgColor;

    if (slide.bgImageId) {
      const url = await Storage.getImageURL(slide.bgImageId);
      if (url) {
        el.style.backgroundImage    = `url('${url}')`;
        el.style.backgroundSize     = 'cover';
        el.style.backgroundPosition = 'center';
      }
    }

    if (slide._kind === 'clock') {
      buildClockSlide(el);
    } else if (slide._kind === 'next') {
      buildNextPrayerSlide(el);
    } else if (slide._kind === 'announcement') {
      el.innerHTML = `
        <div class="slide-announcement">
          ${slide.speakerPhoto ? `<img src="${slide.speakerPhoto}" class="slide-speaker-photo" alt="Speaker">` : ''}
          <div class="slide-ann-content">
            <div class="slide-ann-title">${esc(slide.title || 'Announcement')}</div>
            <div class="slide-ann-desc">${esc(slide.description || '')}</div>
            <div class="slide-ann-meta">
              ${slide.date    ? `<span>📅 ${esc(slide.date)}</span>`    : ''}
              ${slide.time    ? `<span>🕐 ${esc(slide.time)}</span>`    : ''}
              ${slide.speaker ? `<span>🎤 ${esc(slide.speaker)}</span>` : ''}
            </div>
          </div>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="slide-content">
          ${slide.arabic
            ? `<div class="slide-arabic" dir="rtl">${esc(slide.arabic)}</div>`
            : ''}
          ${slide.translation
            ? `<div class="slide-translation">${esc(slide.translation)}</div>`
            : ''}
          ${slide.translationTamil
            ? `<div class="slide-tamil">${esc(slide.translationTamil)}</div>`
            : ''}
          ${slide.source
            ? `<div class="slide-source">${esc(slide.source)}</div>`
            : ''}
        </div>`;
    }

    return el;
  }

  // ── Cross-fade transition between slides ────────────────────────────
  async function showSlide(slide) {
    if (isTransitioning) return;
    const container = document.getElementById('slideshowContainer');
    if (!container) return;

    const newEl = await buildSlideEl(slide);

    // Fade-in setup
    newEl.style.opacity   = '0';
    newEl.style.transition = 'opacity 0.9s ease';
    container.appendChild(newEl);

    isTransitioning = true;

    // Fade out existing slides
    const existing = container.querySelectorAll('.slide-item:not(:last-child)');
    existing.forEach(el => {
      el.style.transition = 'opacity 0.9s ease';
      el.style.opacity    = '0';
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        newEl.style.opacity = '1';
        setTimeout(() => {
          existing.forEach(el => { clearInterval(el._tick); el.remove(); });
          isTransitioning = false;
        }, 950);
      });
    });
  }

  // ── Start the automatic slideshow ───────────────────────────────────
  // The photo is the star of the display, so each slide appears for a few
  // seconds, fades away, and the photo is shown for `slideGapSeconds`
  // before the next slide comes in.
  function hideSlides() {
    const container = document.getElementById('slideshowContainer');
    if (!container) return;
    container.querySelectorAll('.slide-item').forEach(el => {
      el.style.transition = 'opacity 0.9s ease';
      el.style.opacity = '0';
      setTimeout(() => { clearInterval(el._tick); el.remove(); }, 950);
    });
  }

  function start() {
    stop();
    const loop = async () => {
      const cfg = Storage.getSettings();
      if (cfg.slideshowEnabled === false || Countdown.getState() !== Countdown.STATES.NORMAL) {
        hideSlides();
        slideTimer = setTimeout(loop, 3000);
        return;
      }
      if (!roundQueue.length) roundQueue = buildRound();
      if (!roundQueue.length) { slideTimer = setTimeout(loop, 10000); return; }
      const slide = roundQueue.shift();
      await showSlide(slide);
      const showMs = slide.duration || cfg.slideDuration || 8000;
      const gapMs = (cfg.slideGapSeconds != null ? cfg.slideGapSeconds : 10) * 1000;
      slideTimer = setTimeout(() => {
        hideSlides();
        slideTimer = setTimeout(loop, Math.max(1500, gapMs));
      }, showMs);
    };
    slideTimer = setTimeout(loop, 6000);
  }

  function stop() {
    clearTimeout(slideTimer);
    slideTimer = null;
    isTransitioning = false;
  }

  async function refresh() {
    stop();
    await loadData();
    currentIndex = 0; sayingIndex = 0; roundQueue = [];
    start();
  }

  // ── Slide CRUD helpers (used by admin.js) ───────────────────────────
  async function addSlide(slide) {
    if (!slide.id) slide.id = 'slide-' + Date.now();
    await Storage.saveSlide(slide);
    slides = await Storage.getAllSlides();
  }

  async function updateSlide(slide) {
    await Storage.saveSlide(slide);
    slides = await Storage.getAllSlides();
  }

  async function deleteSlide(id) {
    await Storage.deleteSlide(id);
    slides = slides.filter(s => s.id !== id);
  }

  // ── Announcement CRUD helpers ───────────────────────────────────────
  async function addAnnouncement(ann) {
    if (!ann.id) ann.id = 'ann-' + Date.now();
    await Storage.saveAnnouncement(ann);
    announcements = await Storage.getAllAnnouncements();
  }

  async function updateAnnouncement(ann) {
    await Storage.saveAnnouncement(ann);
    announcements = await Storage.getAllAnnouncements();
  }

  async function deleteAnnouncement(id) {
    await Storage.deleteAnnouncement(id);
    announcements = announcements.filter(a => a.id !== id);
  }

  // Escape HTML
  function esc(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    loadData, start, stop, refresh,
    addSlide, updateSlide, deleteSlide,
    addAnnouncement, updateAnnouncement, deleteAnnouncement,
    getActiveSlides,
    get slides()        { return slides;        },
    get announcements() { return announcements; },
    DEFAULT_SLIDES,
  };
})();

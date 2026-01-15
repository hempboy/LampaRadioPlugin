(function () {
  'use strict';
  var API_URL = 'https://raw.githubusercontent.com/hempboy/LampaRadioPlugin/refs/heads/main/stations.json';
  var IMG_BG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAADUlEQVR42gECAP3/AAAAAgABUyucMAAAAABJRU5ErkJggg=='; // black
  var _context = null;
  var _audio = null;
  var _source = null;
  var _gain = null;
  var _analyser = null;
  var _freq = new Uint8Array(1024);
  var _hasfreq = false;
  var _counter = 0;
  var _events = {};
  var _component;
  var played = false;

  // Константы
  var MAX_RECENT_STATIONS = 14;
  
  // Хранилища
  var RECENT_STORAGE_KEY = 'lamparadio_recent_stations';
  var FAVORITES_STORAGE_KEY = 'lamparadio_favorite_stations';
  
  // Цвета визуализатора по умолчанию
  var DEFAULT_ANALYZER_COLOR = '#FF5722';
  var DEFAULT_ANALYZER_BG_COLOR = 'rgba(0, 0, 0, 0)';
  var DEFAULT_ANALYZER_OPACITY = 0.7;

  // Пресеты цветовых гамм
  var COLOR_PRESETS = [
    {
      id: 'fire',
      name: '🔥 Огненная',
      color: '#FF5722',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.7,
      glow: true
    },
    {
      id: 'ocean',
      name: '🌊 Океан',
      color: '#2196F3',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.6,
      glow: true
    },
    {
      id: 'forest',
      name: '🌿 Лесная',
      color: '#4CAF50',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.65,
      glow: false
    },
    {
      id: 'purple',
      name: '💜 Фиолетовая',
      color: '#9C27B0',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.7,
      glow: true
    },
    {
      id: 'sunset',
      name: '🌅 Закат',
      color: '#FF9800',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.75,
      glow: true
    },
    {
      id: 'ice',
      name: '❄️ Ледяная',
      color: '#00BCD4',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.6,
      glow: true
    },
    {
      id: 'gold',
      name: '⭐ Золотая',
      color: '#FFC107',
      bgColor: 'rgba(0, 0, 0, 0.2)',
      opacity: 0.8,
      glow: true
    },
    {
      id: 'matrix',
      name: '🟢 Матрица',
      color: '#00FF00',
      bgColor: 'rgba(0, 0, 0, 0.3)',
      opacity: 0.9,
      glow: false
    },
    {
      id: 'neon',
      name: '🌈 Неон',
      color: '#FF4081',
      bgColor: 'rgba(0, 0, 0, 0.1)',
      opacity: 0.85,
      glow: true
    },
    {
      id: 'cyan',
      name: '🔵 Циан',
      color: '#00E5FF',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.7,
      glow: true
    },
    {
      id: 'classic',
      name: '⚫ Классическая',
      color: '#FFFFFF',
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.5,
      glow: false
    },
    {
      id: 'rainbow',
      name: '🌈 Радужная',
      color: 'rainbow', // Специальный маркер для радужного режима
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.8,
      glow: true
    },
    {
      id: 'gradient',
      name: '🎨 Градиент',
      color: 'gradient', // Специальный маркер для градиентного режима
      bgColor: 'rgba(0, 0, 0, 0)',
      opacity: 0.7,
      glow: false
    }
  ];

  function getRecentStations() {
    try {
      var recent = Lampa.Storage.get(RECENT_STORAGE_KEY);
      return Array.isArray(recent) ? recent : [];
    } catch (e) {
      return [];
    }
  }

  function addRecentStation(station) {
    try {
      var recent = getRecentStations();
      
      // Используем поток в качестве уникального идентификатора
      var stationId = station.stream;
      
      // Удаляем станцию, если она уже есть в списке
      recent = recent.filter(function(s) {
        return s.stream !== stationId;
      });
      
      // Добавляем станцию в начало списка
      recent.unshift({
        id: station.id,
        title: station.title,
        stream: station.stream,
        logo: station.logo,
        largeimage: station.largeimage,
        image: station.image,
        genre: station.genre,
        originalGenre: station.originalGenre,
        description: station.description,
        timestamp: Date.now()
      });
      
      // Ограничиваем размер списка константой
      if (recent.length > MAX_RECENT_STATIONS) {
        recent = recent.slice(0, MAX_RECENT_STATIONS);
      }
      
      Lampa.Storage.set(RECENT_STORAGE_KEY, recent);
      return recent;
    } catch (e) {
      console.error('Error saving recent station:', e);
      return [];
    }
  }

  // Функции для избранных станций
  function getFavoriteStations() {
    try {
      var favorites = Lampa.Storage.get(FAVORITES_STORAGE_KEY);
      return Array.isArray(favorites) ? favorites : [];
    } catch (e) {
      return [];
    }
  }

  function addFavoriteStation(station) {
    try {
      var favorites = getFavoriteStations();
      
      // Используем поток в качестве уникального идентификатора
      var stationId = station.stream;
      
      // Проверяем, нет ли уже станции в избранном
      var exists = favorites.some(function(s) {
        return s.stream === stationId;
      });
      
      if (!exists) {
        favorites.unshift({
          id: station.id,
          title: station.title,
          stream: station.stream,
          logo: station.logo,
          largeimage: station.largeimage,
          image: station.image,
          genre: station.genre,
          originalGenre: station.originalGenre,
          description: station.description,
          timestamp: Date.now()
        });
        
        Lampa.Storage.set(FAVORITES_STORAGE_KEY, favorites);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error saving favorite station:', e);
      return false;
    }
  }

  function removeFavoriteStation(station) {
    try {
      var favorites = getFavoriteStations();
      var initialLength = favorites.length;
      
      // Используем поток в качестве уникального идентификатора
      var stationId = station.stream;
      
      // Удаляем станцию
      favorites = favorites.filter(function(s) {
        return s.stream !== stationId;
      });
      
      if (favorites.length !== initialLength) {
        Lampa.Storage.set(FAVORITES_STORAGE_KEY, favorites);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error removing favorite station:', e);
      return false;
    }
  }

  function isFavoriteStation(station) {
    try {
      var favorites = getFavoriteStations();
      var stationId = station.stream;
      
      return favorites.some(function(s) {
        return s.stream === stationId;
      });
    } catch (e) {
      return false;
    }
  }

  // setup audio routing, called after user interaction, setup once
  function setupAudio() {
    if (_audio && _context) return;
    _audio = new Audio();
    _context = new (window.AudioContext || window.webkitAudioContext)();
    _source = _context.createMediaElementSource(_audio);
    _analyser = _context.createAnalyser();
    _gain = _context.createGain();
    _analyser.fftSize = 1024;
    _source.connect(_analyser);
    _source.connect(_gain);
    _gain.connect(_context.destination);
    _audio.addEventListener('canplay', function (e) {
      console.log('Radio', 'got canplay');
      _freq = new Uint8Array(_analyser.frequencyBinCount);
      _audio.play();
    });
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio#events
    ['play', 'waiting', 'playing', 'ended', 'stalled', 'suspend'].forEach(function (event) {
      _audio.addEventListener(event, function (e) {
        return emit(event, e);
      });
    });
  }
  // emit saved audio event
  function emit(event, data) {
    if (event && _events.hasOwnProperty(event)) {
      console.log('Radio', 'emit', event);
      _events[event].map(function (fn) { fn(data) });
    }
  }
  // add event listeners to the audio api
  function on(event, callback) {
    if (event && typeof callback === 'function') {
      if (!_events[event]) _events[event] = [];
      _events[event].push(callback);
    }
  }
  // stop playing audio
  function stopAudio() {
    if (!_audio) return;
    try {
      _audio.pause();
    } catch (e) { }
    try {
      _audio.stop();
    } catch (e) { }
    try {
      _audio.close();
    } catch (e) { }
  }
  // set audio volume
  function setVolume(volume) {
    if (!_gain) return;
    volume = parseFloat(volume) || 0;
    volume = volume > 1 ? volume / 100 : volume;
    volume = volume > 1 ? 1 : volume;
    volume = volume < 0 ? 0 : volume;
    _audio.muted = volume <= 0 ? true : false;
    _gain.gain.value = volume;
  }
  // update and return analyser frequency value [0-1] to control animations
  function getFreqData(playing) {
    if (!_analyser) return 0;

    _analyser.getByteFrequencyData(_freq);
    var freq = Math.floor(_freq[4] | 0) / 255;

    if (!_hasfreq && freq) {
      _hasfreq = true;
    }

    if (_hasfreq) return freq;

    if (played) {
      _counter = _counter < .6 ? _counter + .01 : _counter;
    } else {
      _counter = _counter > 0 ? _counter - .01 : _counter;
    }
    return _counter;
  }

  // parse channels list from api response
  function parseChannels(channels) {
    var output = [];
    if (Array.isArray(channels)) {
      for (var key in channels) {
        var channel = channels[key];
        if (!channel.title || !channel.stream) continue;
        
        // Generate a unique ID for the channel
        channel.id = Lampa.Utils.hash(channel.title + channel.stream);
        channel.largeimage = channel.logo || IMG_BG;
        channel.image = channel.logo || IMG_BG;
        channel.active = false;
        channel.genre = channel.genre || 'MISCELLANEOUS';
        channel.description = channel.description || '';
        channel.originalGenre = channel.genre; // Keep original for filtering
        
        output.push(channel);
      }
    }
    return output;
  }

  function item(data) {
    var item = Lampa.Template.get('lamparadio_item', {
      id: data.id,
      name: data.title
    });
    var img = item.find('img')[0];
    img.onerror = function () {
      img.src = './img/img_broken.svg';
    };
    img.src = data.largeimage;
    
    // Добавляем иконку избранного ТОЛЬКО если станция уже в избранном
    var favoriteIcon = null;
    var updateFavoriteIcon = function() {
      var isFavorite = isFavoriteStation(data);
      
      if (isFavorite) {
        if (!favoriteIcon) {
          // Создаем иконку только если ее нет и станция в избранном
          favoriteIcon = $('<div class="lamparadio-item__favorite"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/></svg></div>');
          item.append(favoriteIcon);
          favoriteIcon.addClass('active');
        }
      } else {
        // Если станция не в избранном, удаляем иконку
        if (favoriteIcon) {
          favoriteIcon.remove();
          favoriteIcon = null;
        }
      }
    };
    
    // Обновляем иконку при создании
    updateFavoriteIcon();
    
    this.render = function () {
      return item;
    };
    
    this.updateFavoriteIcon = updateFavoriteIcon;
    
    this.destroy = function () {
      img.onerror = function () { };
      img.onload = function () { };
      img.src = '';
      if (favoriteIcon) {
        favoriteIcon.remove();
        favoriteIcon = null;
      }
      item.remove();
    };
  }

  function Component() {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true,
      step: 250
    });
    var player = window.lamparadio_player;
    var items = [];
    var html = $('<div></div>');
    var body = $('<div class="category-full"></div>');
    var active;
    var last;
    
    // State
    var allStations = [];
    var filteredStations = [];
    var currentGenre = null;
    var genres = [];
    var genreFilter = null;

    _component = this;

    // Добавляем метод emit для совместимости
    this.emit = function(event, data) {
      console.log('Component emit:', event, data);
      if (this['on' + event]) {
        this['on' + event](data);
      }
    };

    function createGenreFilter() {
      genreFilter = $('<div class="radio-genres"></div>');
      
      // Добавляем "Избранные" как первый пункт
      var favoritesBtn = $('<div class="radio-genre" data-genre="__favorites__">Избранные</div>');
      genreFilter.append(favoritesBtn);
      
      // Добавляем "Недавно прослушанные" как второй пункт
      var recentBtn = $('<div class="radio-genre" data-genre="__recent__">Недавно прослушанные</div>');
      genreFilter.append(recentBtn);
      
      // Затем "Все жанры"
      var allGenresBtn = $('<div class="radio-genre active" data-genre="">Все жанры</div>');
      genreFilter.append(allGenresBtn);
      
      // Затем все остальные жанры
      genres.forEach(function(genre) {
        if (genre) {
          var genreBtn = $('<div class="radio-genre" data-genre="' + genre + '">' + genre + '</div>');
          genreFilter.append(genreBtn);
        }
      });
      
      genreFilter.on('click', '.radio-genre', function() {
        var genre = $(this).data('genre');
        setGenre(genre);
      });
      
      html.prepend(genreFilter);
    }

    function extractGenres(stations) {
      var genreSet = new Set();
      stations.forEach(function(station) {
        if (station.originalGenre) {
          genreSet.add(station.originalGenre);
        }
      });
      genres = Array.from(genreSet).sort();
    }

    function setGenre(genre) {
      if (currentGenre === genre) return;
      
      currentGenre = genre;
      genreFilter.find('.radio-genre').removeClass('active');
      genreFilter.find('.radio-genre[data-genre="' + (genre || '') + '"]').addClass('active');
      
      filterStations();
      renderStations();
    }

    function filterStations() {
      var stations = allStations.slice();
      
      if (currentGenre === '__favorites__') {
        // Показываем только избранные станции
        var favoriteStations = getFavoriteStations();
        if (favoriteStations.length > 0) {
          var favoriteIds = favoriteStations.map(function(s) { return s.stream; });
          stations = stations.filter(function(s) {
            return favoriteIds.includes(s.stream);
          });
          
          // Сортируем по порядку в favoriteStations
          stations.sort(function(a, b) {
            var indexA = favoriteIds.indexOf(a.stream);
            var indexB = favoriteIds.indexOf(b.stream);
            return indexA - indexB;
          });
        } else {
          // Если нет избранных, показываем пустой список
          stations = [];
        }
      } else if (currentGenre === '__recent__') {
        // Показываем только недавно прослушанные станции
        var recentStations = getRecentStations();
        if (recentStations.length > 0) {
          var recentIds = recentStations.map(function(s) { return s.stream; });
          stations = stations.filter(function(s) {
            return recentIds.includes(s.stream);
          });
          
          // Сортируем по порядку в recentStations
          stations.sort(function(a, b) {
            var indexA = recentIds.indexOf(a.stream);
            var indexB = recentIds.indexOf(b.stream);
            return indexA - indexB;
          });
        } else {
          // Если нет недавно прослушанных, показываем пустой список
          stations = [];
        }
      } else if (currentGenre) {
        // Filter by genre
        stations = stations.filter(function(s) {
          return s.originalGenre === currentGenre;
        });
      }
      // Если currentGenre === '' (Все жанры), то показываем все станции
      
      filteredStations = stations;
    }

    function renderStations() {
      // Clear current items
      items.forEach(function(item) {
        if (item.destroy) item.destroy();
      });
      items = [];
      body.empty();
      
      if (filteredStations.length === 0) {
        // Создаем кастомное сообщение для пустых разделов
        var emptyContainer = $('<div class="lamparadio-empty">' +
          '<div class="lamparadio-empty__title"></div>' +
          '<div class="lamparadio-empty__description"></div>' +
          '</div>');
        
        var title = emptyContainer.find('.lamparadio-empty__title');
        var description = emptyContainer.find('.lamparadio-empty__description');
        
        // Устанавливаем текст в зависимости от раздела
        if (currentGenre === '__favorites__') {
          title.text('Нет избранных станций');
          description.text('Добавьте станции в избранное, нажав на них');
        } else if (currentGenre === '__recent__') {
          title.text('Нет недавно прослушанных');
          description.text('Слушайте радиостанции, и они появятся здесь');
        } else {
          title.text('Нет станций');
          description.text('В этом разделе нет радиостанций');
        }
        
        body.append(emptyContainer);
        return;
      }
      
      // Append stations
      filteredStations.forEach(function(station) {
        var item$1 = new item(station);
        
        item$1.render().on('hover:focus', function () {
          last = item$1.render()[0];
          active = items.indexOf(item$1);
          scroll.update(items[active].render(), true);
        }).on('hover:enter', function () {
          // Показываем диалог с выбором действия
          showStationDialog(station, item$1);
        });
        
        body.append(item$1.render());
        items.push(item$1);
      });
      
      // Добавляем отступ снизу, чтобы видно было названия станций
      body.append('<div class="radio-bottom-padding"></div>');
    }

    function showStationDialog(station, itemObj) {
      var isFavorite = isFavoriteStation(station);
      
      // Создаем элементы диалога
      var dialogHtml = Lampa.Template.get('lamparadio_dialog', {
        title: station.title
      });
      
      var itemsContainer = dialogHtml.find('.lamparadio-dialog__items');
      
      if (isFavorite) {
        itemsContainer.append('<div class="lamparadio-dialog__item" data-action="remove">Удалить из избранного</div>');
      } else {
        itemsContainer.append('<div class="lamparadio-dialog__item" data-action="add">Добавить в избранное</div>');
      }
      
      itemsContainer.append('<div class="lamparadio-dialog__item" data-action="play">Играть</div>');
      
      // Добавляем диалог на страницу
      $('body').append(dialogHtml);
      
      // Функция закрытия диалога
      var dialogActive = true;
      function closeDialog() {
        if (!dialogActive) return;
        dialogActive = false;
        
        // Удаляем диалог
        dialogHtml.remove();
        
        // Возвращаем фокус на элемент списка
        if (last && _component && _component.activity) {
          Lampa.Controller.collectionFocus(last, scroll.render());
        }
        
        // Возвращаем управление основному контроллеру
        Lampa.Controller.toggle('content');
      }
      
      // Обработчики событий
      dialogHtml.on('click', '.lamparadio-dialog__item', function() {
        var action = $(this).data('action');
        
        switch(action) {
          case 'add':
            if (addFavoriteStation(station)) {
              Lampa.Noty.show('Станция добавлена в избранное');
              if (itemObj && itemObj.updateFavoriteIcon) {
                itemObj.updateFavoriteIcon();
              }
              if (currentGenre === '__favorites__') {
                filterStations();
                renderStations();
              }
            }
            closeDialog();
            break;
            
          case 'remove':
            if (removeFavoriteStation(station)) {
              Lampa.Noty.show('Станция удалена из избранного');
              if (itemObj && itemObj.updateFavoriteIcon) {
                itemObj.updateFavoriteIcon();
              }
              if (currentGenre === '__favorites__') {
                filterStations();
                renderStations();
              }
            }
            closeDialog();
            break;
            
          case 'play':
            closeDialog();
            // Делаем небольшую задержку, чтобы диалог успел закрыться
            setTimeout(function() {
              if (window.lamparadio_player && window.lamparadio_player.play) {
                window.lamparadio_player.play(station);
              }
            }, 100);
            break;
        }
      });
      
      // Закрытие по клику вне диалога
      dialogHtml.on('click', function(e) {
        if ($(e.target).hasClass('lamparadio-dialog')) {
          closeDialog();
        }
      });
      
      // Закрытие по клавише Back
      var dialogController = {
        toggle: function() {
          Lampa.Controller.collectionSet(dialogHtml);
          Lampa.Controller.collectionFocus(dialogHtml.find('.lamparadio-dialog__item').first()[0], dialogHtml);
        },
        back: function() {
          closeDialog();
          return true;
        },
        enter: function() {
          var focused = dialogHtml.find('.lamparadio-dialog__item.focus');
          if (focused.length) {
            focused.click();
          }
          return true;
        },
        up: function() {
          var items = dialogHtml.find('.lamparadio-dialog__item');
          var focused = dialogHtml.find('.lamparadio-dialog__item.focus');
          var index = focused.length ? items.index(focused) : 0;
          if (index > 0) {
            items.removeClass('focus');
            items.eq(index - 1).addClass('focus');
          }
          return true;
        },
        down: function() {
          var items = dialogHtml.find('.lamparadio-dialog__item');
          var focused = dialogHtml.find('.lamparadio-dialog__item.focus');
          var index = focused.length ? items.index(focused) : 0;
          if (index < items.length - 1) {
            items.removeClass('focus');
            items.eq(index + 1).addClass('focus');
          }
          return true;
        }
      };
      
      // Активируем управление диалогом
      Lampa.Controller.add('lamparadio-dialog', dialogController);
      Lampa.Controller.toggle('lamparadio-dialog');
    }

    this.create = function () {
      var _this = this;
      this.activity.loader(true);
      
      network.native(API_URL, 
        function (data) {
          try {
            _this.build(data);
            _this.activity.loader(false);
            if (_this.start) {
              _this.start();
            }
          } catch (e) {
            console.error('Error in build:', e);
            _this.activity.loader(false);
          }
        }, 
        function (error) {
          console.error('Failed to load radio stations:', error);
          var emptyContainer = $('<div class="lamparadio-empty">' +
            '<div class="lamparadio-empty__title">Ошибка загрузки данных</div>' +
            '<div class="lamparadio-empty__description">Не удалось загрузить список радиостанций</div>' +
            '</div>');
          html.append(emptyContainer);
          _this.start = function() {
            Lampa.Controller.add('content', {
              toggle: function toggle() {
                Lampa.Controller.collectionSet(html);
                Lampa.Controller.collectionFocus(null, html);
              },
              back: function() {
                _component.back();
              }
            });
            Lampa.Controller.toggle('content');
          };
          _this.activity.loader(false);
        }
      );
      return this.render();
    };

    this.build = function (data) {
      try {
        scroll.minus();
        
        // Parse stations
        if (Array.isArray(data)) {
          allStations = parseChannels(data);
        } else if (data && Array.isArray(data.channels)) {
          allStations = parseChannels(data.channels);
        } else if (data && Array.isArray(data.stations)) {
          allStations = parseChannels(data.stations);
        }
        
        if (allStations.length === 0) {
          console.warn('No stations found in data');
          var emptyContainer = $('<div class="lamparadio-empty">' +
            '<div class="lamparadio-empty__title">Нет доступных станций</div>' +
            '<div class="lamparadio-empty__description">Не удалось загрузить радиостанции</div>' +
            '</div>');
          body.append(emptyContainer);
        } else {
          // Extract genres только из основных станций
          extractGenres(allStations);
          
          // Create UI elements
          createGenreFilter();
          
          // Initial filtering and rendering
          filterStations();
          renderStations();
        }
        
        scroll.append(body);
        html.append(scroll.render());
      } catch (e) {
        console.error('Error in build method:', e);
        throw e;
      }
    };

    this.back = function () {
      // Закрываем диалог, если он открыт
      var dialog = $('.lamparadio-dialog');
      if (dialog.length) {
        dialog.remove();
        Lampa.Controller.remove('lamparadio-dialog');
      }
      Lampa.Activity.backward();
    };

    this.background = function () {
      Lampa.Background.immediately(IMG_BG);
    };

    this.start = function () {
      try {
        if (!this.activity || Lampa.Activity.active().activity !== this.activity) return;
        this.background();
        Lampa.Controller.add('content', {
          toggle: function toggle() {
            Lampa.Controller.collectionSet(scroll.render());
            Lampa.Controller.collectionFocus(last || false, scroll.render());
          },
          left: function left() {
            if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu');
          },
          right: function right() {
            Navigator.move('right');
          },
          up: function up() {
            if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head');
          },
          down: function down() {
            if (Navigator.canmove('down')) Navigator.move('down');
          },
          back: function() {
            _component.back();
          }
        });
        Lampa.Controller.toggle('content');
      } catch (e) {
        console.error('Error in component start:', e);
      }
    };

    this.pause = function () { };
    this.stop = function () { };

    this.render = function () {
      return html;
    };

    this.destroy = function () {
      network.clear();
      if (items && items.length) {
        items.forEach(function(item) {
          if (item && item.destroy) item.destroy();
        });
      }
      scroll.destroy();
      html.remove();
      items = [];
      network = null;
      genreFilter = null;
    };
  }

  function Info(station) {
    var info_html = Lampa.Template.js('lamparadio_info');
    var showAnalyzer = Lampa.Storage.field('lamparadio_show_analyzer');
    
    if (showAnalyzer) {
      var canvas = info_html.find("canvas");
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        var ctx = canvas.getContext("2d");

        var bufferLength = _analyser ? _analyser.frequencyBinCount : 1024;
        var WIDTH = canvas.width;
        var HEIGHT = canvas.height;
        var barWidth = (WIDTH / bufferLength) * 2.5;
        var barHeight;
        var x = 0;
        
        // Получаем настройки цветов
        var analyzerColor = Lampa.Storage.field('lamparadio_analyzer_color') || DEFAULT_ANALYZER_COLOR;
        var analyzerBgColor = Lampa.Storage.field('lamparadio_analyzer_bg_color') || DEFAULT_ANALYZER_BG_COLOR;
        var analyzerOpacity = parseFloat(Lampa.Storage.field('lamparadio_analyzer_opacity')) || DEFAULT_ANALYZER_OPACITY;
        var analyzerGlow = Lampa.Storage.field('lamparadio_analyzer_glow') || false;
        
        // Парсим цвет в RGB
        var parseColor = function(color) {
          if (color.startsWith('#')) {
            var r = parseInt(color.slice(1, 3), 16);
            var g = parseInt(color.slice(3, 5), 16);
            var b = parseInt(color.slice(5, 7), 16);
            return {r: r, g: g, b: b};
          } else if (color.startsWith('rgb')) {
            var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
            if (match) {
              return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? parseFloat(match[4]) : 1
              };
            }
          }
          return {r: 255, g: 87, b: 34}; // оранжевый по умолчанию
        };
        
        // Функция для получения цвета на основе позиции (для радуги)
        function getRainbowColor(position) {
          // position от 0 до 1
          var hue = position * 360;
          return 'hsl(' + hue + ', 100%, 50%)';
        }
        
        // Функция для получения градиентного цвета
        function getGradientColor(position) {
          // Градиент от синего через зеленый к красному
          var colors = [
            {r: 0, g: 150, b: 255},   // синий
            {r: 0, g: 255, b: 150},   // бирюзовый
            {r: 0, g: 255, b: 0},     // зеленый
            {r: 255, g: 255, b: 0},   // желтый
            {r: 255, g: 100, b: 0},   // оранжевый
            {r: 255, g: 0, b: 0}      // красный
          ];
          
          var index = Math.floor(position * (colors.length - 1));
          var nextIndex = Math.min(index + 1, colors.length - 1);
          var progress = (position * (colors.length - 1)) - index;
          
          var color1 = colors[index];
          var color2 = colors[nextIndex];
          
          var r = Math.round(color1.r + (color2.r - color1.r) * progress);
          var g = Math.round(color1.g + (color2.g - color1.g) * progress);
          var b = Math.round(color1.b + (color2.b - color1.b) * progress);
          
          return 'rgb(' + r + ',' + g + ',' + b + ')';
        }
        
        function renderFrame() {
          getFreqData(played);
          
          // Очищаем canvas с фоном
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Заливаем фон, если задан
          if (analyzerBgColor !== 'rgba(0, 0, 0, 0)') {
            ctx.fillStyle = analyzerBgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          
          x = 0;
          for (var i = 0; i < bufferLength; i++) {
            barHeight = _freq[i] * 2;
            
            // Динамическая прозрачность на основе высоты столбца
            var dynamicOpacity = (_freq[i] / 255) * analyzerOpacity;
            
            // Определяем цвет в зависимости от режима
            var currentColor;
            if (analyzerColor === 'rainbow') {
              // Радужный режим
              var position = i / bufferLength;
              currentColor = getRainbowColor(position);
              ctx.fillStyle = currentColor;
            } else if (analyzerColor === 'gradient') {
              // Градиентный режим
              var position = i / bufferLength;
              currentColor = getGradientColor(position);
              ctx.fillStyle = currentColor;
            } else {
              // Обычный цвет
              var color = parseColor(analyzerColor);
              // Градиент для столбцов
              var gradient = ctx.createLinearGradient(x, HEIGHT - barHeight, x, HEIGHT);
              gradient.addColorStop(0, 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + dynamicOpacity + ')');
              gradient.addColorStop(1, 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + (dynamicOpacity * 0.3) + ')');
              ctx.fillStyle = gradient;
            }
            
            ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
            
            // Добавляем свечение
            if (analyzerGlow) {
              ctx.shadowColor = analyzerColor === 'rainbow' || analyzerColor === 'gradient' 
                ? currentColor 
                : 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',' + dynamicOpacity + ')';
              ctx.shadowBlur = 10;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            } else {
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;
            }
            
            x += barWidth + 4;
          }
          
          // Сбрасываем тень после отрисовки всех столбцов
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          
          requestAnimationFrame(renderFrame);
        }
        renderFrame();
      }
    }

    this.create = function () {
      var cover = Lampa.Template.js('lamparadio_cover');
      
      // Создаем бегущую строку в новом формате
      var marqueeText = 'Сейчас играет : ' + station.title + ' в жанре ' + (station.genre || 'MISCELLANEOUS');
      cover.find('.lamparadio-cover__marquee-text').text(marqueeText);

      var img_box = cover.find('.lamparadio-cover__img-box');
      img_box.removeClass('loaded loaded-icon');

      var img_elm = img_box.find('img');
      img_elm.onload = function () {
        img_box.addClass('loaded');
      };
      img_elm.onerror = function () {
        img_elm.src = './img/icons/menu/movie.svg';
        img_box.addClass('loaded-icon');
      };
      img_elm.src = station.largeimage;

      // Проверяем настройки и добавляем соответствующие CSS классы
      var hideLogo = Lampa.Storage.field('lamparadio_hide_logo');
      var hideMarquee = Lampa.Storage.field('lamparadio_hide_marquee');
      
      if (hideLogo === true) {
        img_box.addClass('lamparadio-hide-logo');
      }
      
      if (hideMarquee === true) {
        cover.find('.lamparadio-cover__marquee').addClass('lamparadio-hide-marquee');
      }

      info_html.find('.lamparadio-info__cover').append(cover);
      info_html.find('.lamparadio-info__close').on('click', function () {
        window.history.back();
      });

      document.body.append(info_html);
    };

    this.destroy = function () {
      if (info_html && info_html.remove) {
        info_html.remove();
      }
    };
  }

  function Player() {
    var player_html = Lampa.Template.get('lamparadio_player', {});
    var url = '';
    var screenreset;
    var info;

    setupAudio();

    function prepare() {
      _audio.src = url;
      _audio.preload = 'metadata';
      _audio.crossOrigin = 'anonymous';
      _audio.autoplay = false;
      _audio.load();
      start();
    }

    function start() {
      var playPromise;
      try {
        playPromise = _audio.play();
      } catch (e) { }
      if (playPromise !== undefined) {
        playPromise.then(function () {
          console.log('Radio', 'start playing', url);
        }).catch(function (e) {
          console.log('Radio', 'play promise error:', e.message);
        });
      }
    }

    function play() {
      if (_context && _context.state === 'suspended') {
        _context.resume().then(function () {
          console.log('Radio', 'Audio context has been resumed.');
        });
      }
      player_html.toggleClass('loading', true);
      player_html.toggleClass('stop', false);
      prepare();
    }

    function stop() {
      if (screenreset) {
        clearInterval(screenreset);
        screenreset = null;
      }
      played = false;
      player_html.toggleClass('stop', true);
      player_html.toggleClass('loading', false);
      
      if (_audio) {
        _audio.src = '';
      }
      
      if (info) {
        info.destroy();
        info = false;
      }
    }

    on("play", function () {
      played = true;
    });
    
    on("playing", function () {
      player_html.toggleClass('loading', false);
      if (!screenreset) {
        screenreset = setInterval(function () {
          Lampa.Screensaver.resetTimer();
        }, 5000);
      }
    });
    
    on("waiting", function () {
      player_html.toggleClass('loading', true);
    });

    player_html.on('hover:enter', function () {
      if (played) stop(); else if (url) play();
    });

    this.create = function () {
      $('.head__actions .open--search').before(player_html);
    };

    var curPlayID = null;

    this.play = function (station) {
      if (window.currentPlayer && window.currentPlayer !== this && window.currentPlayer.destroy) {
        window.currentPlayer.destroy();
      }
      window.currentPlayer = this;
      
      if (curPlayID !== station.id || !played) stop();
      
      // Добавляем станцию в недавно прослушанные
      addRecentStation(station);
      
      if (Lampa.Storage.field('lamparadio_show_info') === true) {
        info = new Info(station);
        info.create();
        Lampa.Controller.add('content', {
          invisible: true,
          toggle: function toggle() {
            Lampa.Controller.clear();
            document.body.addClass('ambience--enable');
            Lampa.Background.change(station.largeimage || IMG_BG);
          },
          back: function back() {
            document.body.removeClass('ambience--enable');
            if (info) {
              info.destroy();
              info = false;
            }
            if (_component) _component.activity.toggle();
            Lampa.Controller.toggle('content');
          }
        });
        Lampa.Controller.toggle('content');
      }
      
      if (curPlayID !== station.id || !played) {
        url = station.stream;
        play();
        curPlayID = station.id;
      }
      
      player_html.find('.lamparadio-player__name').text(station.title);
      player_html.toggleClass('hide', false);
      var btn = player_html.find('.lamparadio-player__button');
      if (btn) {
        btn.css({
          "background-image": "url('" + station.largeimage + "')",
          "background-size": "cover"
        });
      }
    };

    this.destroy = function () {
      stop();
      player_html.toggleClass('hide', true);
      curPlayID = null;
    };
  }

  function add() {
    var icon = '<svg enable-background="new 0 0 533.3 377.1" viewBox="0 0 533.3 377.1" xmlns="http://www.w3.org/2000/svg"><path d="m266.7 121.9c36.8 0 66.7 29.8 66.7 66.7s-29.8 66.7-66.7 66.7-66.7-29.9-66.7-66.7 29.8-66.7 66.7-66.7zm-116.7 66.7c0 32.2 13.1 61.4 34.2 82.5l-35.4 35.4c-30.2-30.2-48.8-71.8-48.8-117.9 0-46 18.7-87.7 48.8-117.9l35.4 35.4c-21.1 21.1-34.2 50.2-34.2 82.5zm233.3 0c0-32.2-13.1-61.4-34.2-82.5l35.4-35.4c30.2 30.2 48.8 71.8 48.8 117.9 0 46-18.7 87.7-48.8 117.9l-35.4-35.4c21.2-21.2 34.2-50.3 34.2-82.5zm-333.3 0c0 59.8 24.3 114 63.5 153.2l-35.4 35.4c-48.3-48.3-78.1-115-78.1-188.6s29.8-140.3 78.1-188.6l35.4 35.4c-39.2 39.2-63.5 93.3-63.5 153.2zm433.3 0c0-59.8-24.3-114-63.5-153.2l35.4-35.4c48.3 48.3 78.1 114.9 78.1 188.6s-29.8 140.3-78.1 188.6l-35.4-35.4c39.3-39.2 63.5-93.4 63.5-153.2z" fill="#eee"/></svg>';
    var menu_button = $('<li class="menu__item selector" data-action="radio">' +
      '<div class="menu__ico">' + icon + '</div>' +
      '<div class="menu__text">Radio</div>' +
      '</li>');
      
    menu_button.on('hover:enter', function () {
      Lampa.Activity.push({
        url: '',
        title: 'Радио',
        component: 'lamparadio',
        page: 1
      });
    });
    
    $('.menu .menu__list').eq(0).append(menu_button);
    $('body').append(Lampa.Template.get('lamparadio_style', {}, true));

    window.lamparadio_player = new Player();
    window.lamparadio_player.create();

    addSettings();
  }

  function addSettings() {
    if (window.lamparadio_add_param_ready) return;
    window.lamparadio_add_param_ready = true;

    Lampa.SettingsApi.addComponent({
      component: 'lamparadio',
      name: 'Radio',
      icon: '<svg enable-background="new 0 0 533.3 377.1" viewBox="0 0 533.3 377.1" xmlns="http://www.w3.org/2000/svg"><path d="m266.7 121.9c36.8 0 66.7 29.8 66.7 66.7s-29.8 66.7-66.7 66.7-66.7-29.9-66.7-66.7 29.8-66.7 66.7-66.7zm-116.7 66.7c0 32.2 13.1 61.4 34.2 82.5l-35.4 35.4c-30.2-30.2-48.8-71.8-48.8-117.9 0-46 18.7-87.7 48.8-117.9l35.4 35.4c-21.1 21.1-34.2 50.2-34.2 82.5zm233.3 0c0-32.2-13.1-61.4-34.2-82.5l35.4-35.4c30.2 30.2 48.8 71.8 48.8 117.9 0 46-18.7 87.7-48.8 117.9l-35.4-35.4c21.2-21.2 34.2-50.3 34.2-82.5zm1.1-333.3 0c0 59.8 24.3 114 63.5 153.2l-35.4 35.4c-48.3-48.3-78.1-115-78.1-188.6s29.8-140.3 78.1-188.6l35.4 35.4c-39.2 39.2-63.5 93.3-63.5 153.2zm433.3 0c0-59.8-24.3-114-63.5-153.2l35.4-35.4c48.3 48.3 78.1 114.9 78.1 188.6s-29.8 140.3-78.1 188.6l-35.4-35.4c39.3-39.2 63.5-93.4 63.5-153.2z" fill="#eee"/></svg>'
    });

    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_show_info',
        type: 'trigger',
        "default": true
      },
      field: {
        name: 'Показывать информацию',
        description: 'Открывать информацию о станции при выборе'
      },
      onRender: function onRender(item) { }
    });

    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_show_analyzer',
        type: 'trigger',
        "default": false
      },
      field: {
        name: 'Показать визуализатор',
        description: 'Анализатор аудиоспектра на заднем плане'
      },
      onRender: function onRender(item) { }
    });

    // Новая настройка: Пресеты цветов
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_color_presets',
        type: 'trigger'
      },
      field: {
        name: 'Цветовые пресеты',
        description: 'Быстрый выбор готовых цветовых схем'
      },
      onRender: function onRender(item) {
        // Скрываем стандартный чекбокс
        item.find('.settings-param__value').hide();
        
        // Создаем контейнер для пресетов
        var presetsContainer = $('<div class="lamparadio-presets-container"></div>');
        
        // Добавляем пресеты
        COLOR_PRESETS.forEach(function(preset) {
          var presetElement = $('<div class="lamparadio-preset" data-preset-id="' + preset.id + '">' +
            '<div class="lamparadio-preset__color" style="background-color: ' + (preset.color === 'rainbow' ? 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet)' : preset.color === 'gradient' ? 'linear-gradient(90deg, blue, green, yellow, orange, red)' : preset.color) + '"></div>' +
            '<div class="lamparadio-preset__name">' + preset.name + '</div>' +
            '</div>');
          
          presetElement.on('click', function() {
            // Применяем пресет
            applyPreset(preset);
            
            // Подсвечиваем выбранный пресет
            presetsContainer.find('.lamparadio-preset').removeClass('active');
            $(this).addClass('active');
            
            // Показываем уведомление
            Lampa.Noty.show('Пресет "' + preset.name + '" применен');
            
            // Обновляем остальные настройки цветов, если они уже отображены
            updateColorSettings(preset);
          });
          
          presetsContainer.append(presetElement);
        });
        
        // Проверяем, какой пресет сейчас активен
        var currentColor = Lampa.Storage.field('lamparadio_analyzer_color') || DEFAULT_ANALYZER_COLOR;
        var currentBgColor = Lampa.Storage.field('lamparadio_analyzer_bg_color') || DEFAULT_ANALYZER_BG_COLOR;
        var currentOpacity = parseFloat(Lampa.Storage.field('lamparadio_analyzer_opacity')) || DEFAULT_ANALYZER_OPACITY;
        var currentGlow = Lampa.Storage.field('lamparadio_analyzer_glow') || false;
        
        // Ищем совпадение с пресетами
        var matchingPreset = COLOR_PRESETS.find(function(preset) {
          return preset.color === currentColor && 
                 preset.bgColor === currentBgColor && 
                 Math.abs(preset.opacity - currentOpacity) < 0.01 &&
                 preset.glow === currentGlow;
        });
        
        // Если нашли совпадение, подсвечиваем пресет
        if (matchingPreset) {
          setTimeout(function() {
            presetsContainer.find('.lamparadio-preset[data-preset-id="' + matchingPreset.id + '"]').addClass('active');
          }, 100);
        }
        
        item.find('.settings-param__descr').append(presetsContainer);
      }
    });

    // Новая настройка: Цвет визуализатора
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_analyzer_color',
        type: 'string',
        "default": DEFAULT_ANALYZER_COLOR
      },
      field: {
        name: 'Цвет визуализатора',
        description: 'Цвет в формате HEX (#FF5722) или RGB (rgb(255,87,34))'
      },
      onRender: function onRender(item) {
        // Добавляем подсказку о формате цвета
        var description = item.find('.settings-param__descr');
        description.append('<div style="margin-top: 5px; font-size: 0.9em; opacity: 0.8;">Примеры: #FF5722 (оранжевый), #2196F3 (синий), #4CAF50 (зеленый), #FF4081 (розовый)</div>');
      }
    });

    // Новая настройка: Цвет фона визуализатора
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_analyzer_bg_color',
        type: 'string',
        "default": DEFAULT_ANALYZER_BG_COLOR
      },
      field: {
        name: 'Фон визуализатора',
        description: 'Цвет фона в формате rgba (например, rgba(0,0,0,0.3))'
      },
      onRender: function onRender(item) {
        var description = item.find('.settings-param__descr');
        description.append('<div style="margin-top: 5px; font-size: 0.9em; opacity: 0.8;">Прозрачный фон: rgba(0,0,0,0), Чёрный: rgba(0,0,0,0.3)</div>');
      }
    });

    // Новая настройка: Прозрачность визуализатора
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_analyzer_opacity',
        type: 'string',
        "default": DEFAULT_ANALYZER_OPACITY.toString()
      },
      field: {
        name: 'Прозрачность визуализатора',
        description: 'Значение от 0.1 (почти прозрачно) до 1 (непрозрачно)'
      },
      onRender: function onRender(item) {
        var description = item.find('.settings-param__descr');
        description.append('<div style="margin-top: 5px; font-size: 0.9em; opacity: 0.8;">Рекомендуется: 0.3-0.8</div>');
      }
    });

    // Новая настройка: Эффект свечения
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_analyzer_glow',
        type: 'trigger',
        "default": false
      },
      field: {
        name: 'Эффект свечения',
        description: 'Добавить свечение к столбцам визуализатора'
      },
      onRender: function onRender(item) { }
    });

    // Новая настройка: скрыть логотип станции
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_hide_logo',
        type: 'trigger',
        "default": false
      },
      field: {
        name: 'Скрыть логотип в полном экране',
        description: 'Изображение загружается, но не отображается'
      },
      onRender: function onRender(item) { }
    });

    // Новая настройка: скрыть бегущую строку
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_hide_marquee',
        type: 'trigger',
        "default": false
      },
      field: {
        name: 'Скрыть бегущую строку в полном экране',
        description: 'Текст загружается, но не отображается'
      },
      onRender: function onRender(item) { }
    });

    // Информационный пункт о поддержке
    Lampa.SettingsApi.addParam({
      component: 'lamparadio',
      param: {
        name: 'lamparadio_info_support',
        type: 'trigger'
      },
      field: {
        name: 'О проекте',
        description: 'Поддержать создателей радиостанций'
      },
      onRender: function onRender(item) {
        // Создаем кастомный элемент для информационного сообщения
        var infoContainer = $('<div class="lamparadio-info-support">' +
          '<div class="lamparadio-info-support__title">Информация о радиостанциях</div>' +
          '<div class="lamparadio-info-support__text">Данное радио использует информацию о станциях из открытых источников. Для поддержки проекта посетите сайт <span class="lamparadio-info-support__highlight">radcap.ru</span></div>' +
          '<div class="lamparadio-info-support__footer">Спасибо за использование плагина!</div>' +
          '</div>');
        
        // Заменяем содержимое элемента настроек
        item.find('.settings-param__descr').html(infoContainer);
        item.find('.settings-param__name').hide();
        item.off('click').removeClass('selector').css('opacity', 0.9);
      }
    });
  }

  // Функция для применения пресета
  function applyPreset(preset) {
    Lampa.Storage.set('lamparadio_analyzer_color', preset.color);
    Lampa.Storage.set('lamparadio_analyzer_bg_color', preset.bgColor);
    Lampa.Storage.set('lamparadio_analyzer_opacity', preset.opacity.toString());
    Lampa.Storage.set('lamparadio_analyzer_glow', preset.glow);
  }

  // Функция для обновления настроек цветов
  function updateColorSettings(preset) {
    // Находим элементы настроек и обновляем их значения
    $('.settings-param[data-param="lamparadio_analyzer_color"] input').val(preset.color);
    $('.settings-param[data-param="lamparadio_analyzer_bg_color"] input').val(preset.bgColor);
    $('.settings-param[data-param="lamparadio_analyzer_opacity"] input').val(preset.opacity.toString());
    
    var glowCheckbox = $('.settings-param[data-param="lamparadio_analyzer_glow"] input[type="checkbox"]');
    if (glowCheckbox.length) {
      glowCheckbox.prop('checked', preset.glow);
    }
  }

  function createRadio() {
    window.plugin_lamparadio_ready = true;

    var manifest = {
      type: 'audio',
      version: '1.4.0',
      name: 'Радио',
      description: 'Коллекция радиостанций с избранным и историей прослушивания',
      component: 'lamparadio'
    };
    
    Lampa.Manifest.plugins = manifest;

    // Шаблоны
    Lampa.Template.add('lamparadio_item', '<div class="selector lamparadio-item">' +
      '<div class="lamparadio-item__imgbox">' +
      '<img class="lamparadio-item__img" />' +
      '</div>' +
      '<div class="lamparadio-item__name">{name}</div>' +
      '</div>');

    Lampa.Template.add('lamparadio_player', '<div class="selector lamparadio-player loading stop hide">' +
      '<div class="lamparadio-player__name">Radio</div>' +
      '<div id="lamparadio_player_button" class="lamparadio-player__button">' +
      '<i></i>' +
      '<i></i>' +
      '<i></i>' +
      '<i></i>' +
      '</div>' +
      '</div>');

    Lampa.Template.add('lamparadio_info', '<div class="lamparadio-info">' +
      '<canvas id="canvas"></canvas>' +
      '<div>' +
      '<div class="lamparadio-info__cover"></div>' +
      '</div>' +
      '<div class="lamparadio-info__close">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 329.269 329" xml:space="preserve">' +
      '<path d="M194.8 164.77 323.013 36.555c8.343-8.34 8.343-21.825 0-30.164-8.34-8.34-21.825-8.34-30.164 0L164.633 134.605 36.422 6.391c-8.344-8.34-21.824-8.34-30.164 0-8.344 8.34-8.344 21.824 0 30.164l128.21 128.215L6.259 292.984c-8.344 8.34-8.344 21.825 0 30.164a21.266 21.266 0 0 0 15.082 6.25c5.46 0 10.922-2.09 15.082-6.25l128.21-128.214 128.216 128.214a21.273 21.273 0 0 0 15.082 6.25c5.46 0 10.922-2.09 15.082-6.25 8.343-8.34 8.343-21.824 0-30.164zm0 0" fill="currentColor"></path>' +
      '</svg>' +
      '</div>' +
      '</div>');

    Lampa.Template.add('lamparadio_cover', '<div class="lamparadio-cover">' +
      '<div class="lamparadio-cover__img-container">' +
      '<div class="lamparadio-cover__img-box">' +
      '<img src="" />' +
      '</div>' +
      '</div>' +
      '<div class="lamparadio-cover__marquee">' +
      '<div class="lamparadio-cover__marquee-text"></div>' +
      '</div>' +
      '</div>');

    // Шаблон для диалога
    Lampa.Template.add('lamparadio_dialog', '<div class="lamparadio-dialog">' +
      '<div class="lamparadio-dialog__content">' +
      '<div class="lamparadio-dialog__title">{title}</div>' +
      '<div class="lamparadio-dialog__items"></div>' +
      '</div>' +
      '</div>');

    // CSS стили с добавлением стилей для пустого состояния и информационного блока
    Lampa.Template.add('lamparadio_style', '<style>' +
      '.radio-genres { display: flex; flex-wrap: wrap; padding: 1em; gap: 0.5em; justify-content: center; }' +
      '.radio-genre { padding: 0.3em 0.8em; border-radius: 0.3em; background: rgba(255,255,255,0.1); cursor: pointer; font-size: 0.9em; }' +
      '.radio-genre.active { background: #fff; color: #000; }' +
      '.lamparadio-item { margin-left: 1em; margin-bottom: 1em; width: 13%; -webkit-flex-shrink: 0; -ms-flex-negative: 0; flex-shrink: 0; position: relative; }' +
      '.lamparadio-item__imgbox { background-color: #3e3e3e; padding-bottom: 100%; position: relative; -webkit-border-radius: 0.3em; -moz-border-radius: 0.3em; border-radius: 0.3em; }' +
      '.lamparadio-item__img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -webkit-border-radius: 0.4em; -moz-border-radius: 0.4em; border-radius: 0.4em; }' +
      '.lamparadio-item__name { font-size: 1.1em; margin-top: 0.8em; }' +
      '.lamparadio-item__favorite { position: absolute; top: 0.3em; right: 0.3em; width: 1.2em; height: 1.2em; z-index: 2; opacity: 0.7; }' +
      '.lamparadio-item__favorite svg { width: 100%; height: 100%; fill: #fff; }' +
      '.lamparadio-item__favorite.active svg { fill: #ff4757; }' +
      '.lamparadio-item.focus .lamparadio-item__imgbox:after { border: solid 0.26em #fff; content: ""; display: block; position: absolute; left: -0.5em; top: -0.5em; right: -0.5em; bottom: -0.5em; -webkit-border-radius: 0.8em; -moz-border-radius: 0.8em; border-radius: 0.8em; }' +
      '.radio-bottom-padding { height: 100px; width: 100%; }' +
      '.lamparadio-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center; padding: 2em; }' +
      '.lamparadio-empty__title { font-size: 1.5em; font-weight: 500; margin-bottom: 0.5em; color: #fff; }' +
      '.lamparadio-empty__description { font-size: 1.1em; color: rgba(255,255,255,0.7); max-width: 400px; line-height: 1.4; }' +
      '.lamparadio-info-support { padding: 1em; }' +
      '.lamparadio-info-support__title { font-size: 1.2em; margin-bottom: 0.5em; color: #fff; }' +
      '.lamparadio-info-support__text { font-size: 1em; line-height: 1.4; color: rgba(255,255,255,0.8); margin-bottom: 0.5em; }' +
      '.lamparadio-info-support__highlight { color: #4CAF50; font-weight: bold; }' +
      '.lamparadio-info-support__footer { font-size: 0.9em; color: rgba(255,255,255,0.6); margin-top: 1em; }' +
      '.lamparadio-hide-logo { display: none !important; }' +
      '.lamparadio-hide-marquee { display: none !important; }' +
      '.lamparadio-presets-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; }' +
      '.lamparadio-preset { background: rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; cursor: pointer; transition: all 0.3s ease; border: 2px solid transparent; }' +
      '.lamparadio-preset:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }' +
      '.lamparadio-preset.active { border-color: #4CAF50; background: rgba(76, 175, 80, 0.1); }' +
      '.lamparadio-preset__color { width: 100%; height: 30px; border-radius: 4px; margin-bottom: 8px; }' +
      '.lamparadio-preset__name { font-size: 0.9em; text-align: center; color: #fff; }' +
      '@media screen and (max-width: 580px) { .lamparadio-presets-container { grid-template-columns: repeat(2, 1fr); } .lamparadio-item { width: 21%; } }' +
      '@media screen and (max-width: 385px) { .lamparadio-presets-container { grid-template-columns: 1fr; } .lamparadio-item__name { display: none; } .lamparadio-item__favorite { width: 1em; height: 1em; } }' +
      '.lamparadio-player { display: -webkit-box; display: -webkit-flex; display: -moz-box; display: -ms-flexbox; display: flex; -webkit-box-align: center; -webkit-align-items: center; -moz-box-align: center; -ms-flex-align: center; align-items: center; -webkit-border-radius: 0.3em; -moz-border-radius: 0.3em; border-radius: 0.3em; padding: 0.2em 0.4em; margin-left: 0.5em; margin-right: 0.5em; }' +
      '.lamparadio-player__name { margin-right: 0.35em; white-space: nowrap; overflow: hidden; -o-text-overflow: ellipsis; text-overflow: ellipsis; max-width: 8em; display: none; }' +
      '.lamparadio-player__button { position: relative; width: 2em; height: 2em; display: -webkit-box; display: -webkit-flex; display: -moz-box; display: -ms-flexbox; display: flex; -webkit-box-align: center; -webkit-align-items: center; -moz-box-align: center; -ms-flex-align: center; align-items: center; -webkit-box-pack: center; -webkit-justify-content: center; -moz-box-pack: center; -ms-flex-pack: center; justify-content: center; -webkit-flex-shrink: 0; -ms-flex-negative: 0; flex-shrink: 0; -webkit-border-radius: 0.3em; -moz-border-radius: 0.3em; border-radius: 0.3em; border: 0.15em solid rgba(255, 255, 255, 1); }' +
      '.lamparadio-player__button > * { opacity: 0.75; }' +
      '.lamparadio-player__button i { display: block; width: 0.2em; background-color: #fff; margin: 0 0.1em; -webkit-animation: sound 0ms -800ms linear infinite alternate; -moz-animation: sound 0ms -800ms linear infinite alternate; -o-animation: sound 0ms -800ms linear infinite alternate; animation: sound 0ms -800ms linear infinite alternate; -webkit-flex-shrink: 0; -ms-flex-negative: 0; flex-shrink: 0; }' +
      '.lamparadio-player__button i:nth-child(1) { -webkit-animation-duration: 474ms; -moz-animation-duration: 474ms; -o-animation-duration: 474ms; animation-duration: 474ms; }' +
      '.lamparadio-player__button i:nth-child(2) { -webkit-animation-duration: 433ms; -moz-animation-duration: 433ms; -o-animation-duration: 433ms; animation-duration: 433ms; }' +
      '.lamparadio-player__button i:nth-child(3) { -webkit-animation-duration: 407ms; -moz-animation-duration: 407ms; -o-animation-duration: 407ms; animation-duration: 407ms; }' +
      '.lamparadio-player__button i:nth-child(4) { -webkit-animation-duration: 458ms; -moz-animation-duration: 458ms; -o-animation-duration: 458ms; animation-duration: 458ms; }' +
      '.lamparadio-player.stop .lamparadio-player__button i { display: none; }' +
      '.lamparadio-player.stop .lamparadio-player__button:after { content: ""; width: 0.5em; height: 0.5em; background-color: rgba(255, 255, 255, 1); }' +
      '.lamparadio-player.loading .lamparadio-player__button:before { content: ""; display: block; border-top: 0.2em solid rgba(255, 255,255, 0.9); border-left: 0.2em solid transparent; border-right: 0.2em solid transparent; border-bottom: 0.2em solid transparent; -webkit-animation: sound-loading 1s linear infinite; -moz-animation: sound-loading 1s linear infinite; -o-animation: sound-loading 1s linear infinite; animation: sound-loading 1s linear infinite; width: 0.9em; height: 0.9em; -webkit-border-radius: 100%; -moz-border-radius: 100%; border-radius: 100%; -webkit-flex-shrink: 0; -ms-flex-negative: 0; flex-shrink: 0; }' +
      '.lamparadio-player.loading .lamparadio-player__button i { display: none; }' +
      '.lamparadio-player.focus { background-color: #fff; color: #000; }' +
      '.lamparadio-player.focus .lamparadio-player__name { display: inline; }' +
      '@media screen and (max-width: 580px) { .lamparadio-player.focus .lamparadio-player__name { display: none; } }' +
      '@media screen and (max-width: 385px) { .lamparadio-player.focus .lamparadio-player__name { display: none; } }' +
      '.lamparadio-player.focus .lamparadio-player__button { border-color: #000; }' +
      '.lamparadio-player.focus .lamparadio-player__button i, .lamparadio-player.focus .lamparadio-player__button:after { background-color: #000; }' +
      '.lamparadio-player.focus .lamparadio-player__button:before { border-top-color: #000; }' +
      '.lamparadio-cover { text-align: center; line-height: 1.4; padding-top: 10px; }' +
      '.lamparadio-cover__img-container { max-width: 15em; margin: 0 auto 5px; }' +
      '.lamparadio-cover__img-box { position: relative; padding-bottom: 100%; background-color: rgba(0, 0, 0, 0.3); -webkit-border-radius: 0.5em; -moz-border-radius: 0.5em; border-radius: 0.5em; }' +
      '.lamparadio-cover__img-box > img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; -webkit-border-radius: 0.5em; -moz-border-radius: 0.5em; border-radius: 0.5em; opacity: 0; }' +
      '.lamparadio-cover__img-box.loaded { background-color: transparent; }' +
      '.lamparadio-cover__img-box.loaded > img { opacity: 1; }' +
      '.lamparadio-cover__img-box.loaded-icon { background-color: rgba(0, 0, 0, 0.3); }' +
      '.lamparadio-cover__img-box.loaded-icon > img { left: 20%; top: 20%; width: 60%; height: 60%; opacity: 0.2; }' +
      '.lamparadio-cover__marquee { width: 100%; overflow: hidden; position: relative; margin-top: 5px; }' +
      '.lamparadio-cover__marquee-text { display: inline-block; padding-left: 100%; white-space: nowrap; animation: lamparadio-marquee 15s linear infinite; font-size: 1.3em; font-weight: 500; color: #fff; }' +
      '@keyframes lamparadio-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }' +
      '.lamparadio-info { position: fixed; z-index: 100; left: 0; top: 0; width: 100%; height: 100%; display: -webkit-box; display: -webkit-flex; display: -moz-box; display: -ms-flexbox; display: flex; -webkit-box-align: center; -webkit-align-items: center; -moz-box-align: center; -ms-flex-align: center; align-items: center; -webkit-box-pack: center; -webkit-justify-content: center; -moz-box-pack: center; -ms-flex-pack: center; justify-content: center; }' +
      '.lamparadio-info__cover { width: 30em; }' +
      '.lamparadio-info__close { position: fixed; top: 5em; right: 50%; margin-right: -2em; -webkit-border-radius: 100%; -moz-border-radius: 100%; border-radius: 100%; padding: 1em; display: none; background-color: rgba(255, 255, 255, 0.1); }' +
      '.lamparadio-info__close > svg { width: 1.5em; height: 1.5em; }' +
      'body.true--mobile .lamparadio-info__close { display: block; }' +
      '@media screen and (min-height: 320px) and (max-height: 428px) and (orientation: landscape) { .lamparadio-info__close { position: fixed; top: 5%; right: 95%; margin-right: -2em; } .lamparadio-cover__img-container { max-width: 12em; } .lamparadio-cover { padding-top: 10px; } }' +
      '#canvas { position: absolute; left: 0; bottom: 0; width: 100%; height: 100%; z-index: -1; }' +
      '.lamparadio-dialog { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }' +
      '.lamparadio-dialog__content { background: #2a2a2a; padding: 1.5em; border-radius: 0.5em; min-width: 300px; max-width: 90%; }' +
      '.lamparadio-dialog__title { font-size: 1.3em; margin-bottom: 1em; text-align: center; color: #fff; }' +
      '.lamparadio-dialog__item { padding: 0.8em 1em; color: #fff; cursor: pointer; border-radius: 0.3em; margin-bottom: 0.5em; background: rgba(255,255,255,0.1); }' +
      '.lamparadio-dialog__item:last-child { margin-bottom: 0; }' +
      '.lamparadio-dialog__item:hover, .lamparadio-dialog__item.focus { background: rgba(255,255,255,0.2); }' +
      '.lamparadio-dialog__item[data-action="play"] { color: #4CAF50; }' +
      '@keyframes sound { 0% { height: 0.1em; } 100% { height: 1em; } }' +
      '@keyframes sound-loading { 0% { -webkit-transform: rotate(0deg); -moz-transform: rotate(0deg); -o-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); -moz-transform: rotate(360deg); -o-transform: rotate(360deg); transform: rotate(360deg); } }' +
      '</style>');

    Lampa.Component.add("lamparadio", Component);

    if (window.appready) {
      add();
    } else {
      Lampa.Listener.follow("app", function (e) {
        if (e.type == "ready") add();
      });
    }
  }

  if (!window.plugin_lamparadio_ready) createRadio();

})();

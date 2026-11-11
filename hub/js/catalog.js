/* Danh mục game. Dữ liệu tên/emoji/mô tả/màu được tools/build-www.mjs trích từ mảng GENRES
 * trong /index.html và ghi ra js/catalog-data.js (window.TG_GENRES). File này thêm luật mở khoá. */
(function () {
  'use strict';
  var TG = window.TG;
  var RAW = window.TG_GENRES || [];

  // 16 game miễn phí từ đầu (ít nhất 2 game mỗi thể loại). Còn lại: [cấp cần đạt, giá xu].
  var LOCKS = {
    'arcade/game3': [4, 300],
    'puzzle/game3': [3, 250],
    'board/game2': [5, 350],
    'board/game3': [7, 450],
    'action/game3': [6, 400],
    'action/game4': [9, 550],
    'strategy/game3': [8, 500],
    'strategy/game4': [11, 650],
    'casual/game2': [2, 150],
    'casual/game4': [3, 200],
    'multiplayer/game2': [4, 300],
    'multiplayer/game4': [6, 400]
  };

  var SHORT = {
    arcade: 'Arcade', puzzle: 'Giải đố', board: 'Cờ & Bài', action: 'Hành động',
    strategy: 'Chiến thuật', casual: 'Học & Chơi', multiplayer: 'Chơi chung'
  };

  var genres = [], games = [], byId = {};
  RAW.forEach(function (g) {
    var G = { id: g.id, name: g.name, short: SHORT[g.id] || g.name, note: g.note, color: g.color, games: [] };
    g.games.forEach(function (row, i) {
      var id = g.id + '/game' + (i + 1);
      var lock = LOCKS[id];
      var game = {
        id: id, genre: g.id, genreName: g.name, color: g.color,
        emoji: row[0], name: row[1], desc: row[2],
        url: 'games/' + id + '.html',
        free: !lock, reqLevel: lock ? lock[0] : 0, price: lock ? lock[1] : 0
      };
      G.games.push(game); games.push(game); byId[id] = game;
    });
    genres.push(G);
  });

  TG.catalog = {
    genres: genres,
    games: games,
    get: function (id) { return byId[id] || null; },
    genre: function (id) { for (var i = 0; i < genres.length; i++) if (genres[i].id === id) return genres[i]; return null; }
  };
})();

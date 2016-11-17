"use strict";
const io = require('socket.io')();
const fs = require('fs');

let mediaPath = __dirname + '/../d3-audio-spectrum/public/media';
console.log(mediaPath);
let servePath = 'media/';
let playlist  = [];
let playing   = null;
let voteDelay = 250; // 1/4 second delay between votes

// generate playlist from files in the media path
for (let file of fs.readdirSync(mediaPath)) {
  let parts = file.split('-');
  if (parts.length !== 2) {
    console.log('Ignoring: ', file);
    continue;
  }

  playlist.push({
    file:   servePath + file,
    title:  parts[1].substring(0, parts[1].lastIndexOf('.')).trim(),
    artist: parts[0].trim(),
    votes:  0
  });

  playlist.sort((a, b) => {
    return a.file.toLowerCase().localeCompare(b.file.toLowerCase());
  });
}

io.on('connection', (socket) => {
  console.log('connection')
  // emit current/initial state
  console.log('emitting playlist-update')
  socket.emit('playlist-update', playlist);
  if (playing) socket.emit('play-start', playing);

  // broadcast audio spectrum data
  socket.on('audio-update-private', (data) => {
    console.log('Received audio-update-private')
    console.log('Emitting audio-update')
    socket.emit('audio-update', data);
  });

  // accept votes and update playlist
  let lastVote = null;
  socket.on('vote-cast', (song) => {
	console.log('Received vote-cast')
    // throttle votes per client
    let now = Date.now();
    if (now - lastVote < voteDelay) return;
    lastVote = now;

    song = playlist.find((entry) => {
      return entry.file === song.file;
    });
    if (!song) return;

    song.votes++;

    // emit update to all connected sockets
	console.log('Emitting vote-cast')
    io.sockets.emit('playlist-update', playlist);
  });

  // listen for play start and update now playing
  socket.on('play-start-private', (song) => {
    console.log('Received play-start-private')
    if (song == false) {
      song = playlist[0];
    }
    else {
      song = playlist.find((entry) => {
        return entry.file === song.file;
      });
    }
    if (!song) return;

    // update currently playing song
    playing = song;

    // we want to reset votes
    song.votes = 0;

    // update all connected sockets
    console.log('Emitting playlist-update')
    console.log('Emitting play-start')
    io.sockets.emit('playlist-update', playlist);
    io.sockets.emit('play-start', song);
  });
});

console.log('Listening: 8080');
io.listen(8080);

var express = require('express');
var cheerio = require('cheerio');
var request = require('request');

var app = express();

var tag = /^(.+) created tag (.+) at \1\/(.+)$/;
function getTag(title) {
	var m = title.match(tag);
	if(m) {
		return {
			user: m[1],
			tag:  m[2],
			repo: m[3]
		};
	}

	return false;
}

function entryTitle(tag) {
	return 'Version ' + tag.tag + ' of ' + tag.repo + ' released';
}

function entryHref(tag) {
	return 'https://github.com/' + tag.user + '/' + tag.repo;
}

function mungeEntry(entry, tag) {
	entry.find('title').text(entryTitle(tag));
	entry.find('link').attr('href', entryHref(tag));
	var thumb = entry.find('media\\:thumbnail');
	thumb.attr('url', (thumb.attr('url') || '').replace(/&/g, '&amp;'));
	return entry;
}

function getTagEntries($) {
	return [].slice.call($('entry')).map(function(entry) {
		var $entry = $(entry);
		var tag = getTag($entry.find('title').text());
		if(tag) return mungeEntry($entry, tag);
	}).filter(Boolean);
}

var parseTitle = /(.+)'s Activity/;
function feedWrapper($, host, protocol) {
	var feed = $('feed').clone();
	var user = feed.find('title').text().match(parseTitle)[1];
	feed.find('entry').remove();
	feed.find('title').text(user + '&#39;s software releases');
	feed.find('[rel="self"]').attr('href', protocol + '://' + host + '/' + user + '.atom');
	return feed;
}

app.param('user', function(req, res, next, id) {
	request('https://github.com/' + id + '.atom', function(err, resp, body) {
		if(err) {
			next(err);
		} else if(resp.statusCode !== 200) {
			next(resp.statusCode);
		} else {
			req.feed = body;
			next();
		}
	});
});

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.get('/:user.atom', function(req, res) {
	var $ = cheerio.load(req.feed);
	var feed = feedWrapper($, req.hostname, req.protocol);
	var entries = getTagEntries($);
	feed.append(entries);

	res.type('atom');
	res.send('<?xml version="1.0" encoding="UTF-8"?>\n' + $.xml(feed));
});

app.listen(process.env.PORT || 3000);

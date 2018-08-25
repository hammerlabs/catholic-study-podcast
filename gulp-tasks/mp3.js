import gulp from "gulp";
import toml from "toml";
import fs from "fs";
import path from "path";
import ID3Writer from "browser-id3-writer";
import mp3Duration from "mp3-duration";

var exec = require("child_process").exec;

gulp.task("mp3-read-tags", function() {
  const dir = "./site/content/episode";
  fs.readdir(dir, function(err, items) {
    for (var i = 0; i < items.length; i++) {
      console.log(items[i]);
      var tdata = readEpisodeID3(path.join(dir, items[i]));
      console.log(tdata);
    }
  });
});

function readEpisodeID3(mdfile) {
  const content = fs.readFileSync(mdfile, "utf-8");
  var tomlString = content.split("+++")[1];
  var tdata = toml.parse(tomlString);
  return tdata;
}

gulp.task("mp3-set-size", async function() {
  const dir = "./site/content/bible-study";
  // read all files in the content/episode
  fs.readdir(dir, async function(err, items) {
    if (err) {
      return console.log(err.message);
    }
    // loop through the episode MD files to get the TOML data from each
    for (var i = 0; i < items.length; i++) {
      var content = fs.readFileSync(path.join(dir, items[i]), "utf-8");
      var tomlString = content.split("+++")[1];
      var tdata = toml.parse(tomlString);
      var mp3FilePath = "./media/channel/bible-study/" + tdata.podcast_file;
      const stats = fs.statSync(mp3FilePath);
      const fileSizeInBytes = stats.size;
      var fileLengthInSeconds = await mp3Duration(mp3FilePath, function(err, duration) {
        if (err) return console.log(err.message);
        return duration;
      });
      var fileDuration = new Date(fileLengthInSeconds * 1000).toISOString().substr(11, 8);
      content = content.replace(/podcast_duration = \".*\"/, "podcast_duration = \"" + fileDuration + "\"");
      content = content.replace(/podcast_bytes = \".*\"/, "podcast_bytes = \"" + fileSizeInBytes + "\"");
      fs.writeFileSync(path.join(dir, items[i]), content, "utf8");
      console.log(tdata.podcast_file + ": " + fileSizeInBytes + " bytes and is " + fileDuration + " long");
    }
  });
});

gulp.task("mp3-write-tags", function() {
  const dir = "./site/content/bible-study";
  fs.readdir(dir, function(err, items) {
    for (var i = 0; i < items.length; i++) {
      console.log(items[i]);
      var tdata = readEpisodeToml(path.join(dir, items[i]));
      writeID3Tags(tdata, items[i]);
    }
  });
});

function readEpisodeToml(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  var tomlString = content.split("+++")[1];
  var tdata = toml.parse(tomlString);
  //console.log(tdata);
  return tdata;
}

function writeID3Tags(tdata, itemId) {
  const infile = "./media/post/bible-study/" + tdata.podcast_file;
  const outfile = "./media/channel/bible-study/" + tdata.podcast_file;
  const coverfile = "./site/static/" + tdata.episode_cover;

  const args = [
    "-pcon",
    "-pcfd", "https://www.catholicstudypodcast.com/bible-study/index.xml",
    "-pcds", "\"Study sacred scripture with a focus on historical context and interpretation. What did the scriptures mean to those to whom it was written? That\'s the key to knowing what it means to us today!\"",
    "-ti", "\"" + tdata.title + "\"",
    "-t", "\"" + tdata.title + "\"",
    "-ar", "\"" + tdata.hosts[0] + "\"",
    "-a", "\"" + tdata.hosts[0] + "\"",
    "-al", "\"Catholic Study Podcast\"",
    "-b", "\"Catholic Study Podcast\"",
    "-yr", tdata.PublishDate.getFullYear(),
    "-y", tdata.PublishDate.getFullYear(),
    "-c", "catholicstudypodcast.com",
    "-g", "12",
    "-gn", "Podcast",
    "-co", "\"" + tdata.Description + "\"",
    "-ur", "https://www.catholicstudypodcast.com/bible-study/" + itemId + "/",
    "-ir", coverfile,
    "-ad", "2",
    "-out", outfile,
    infile
  ];

  exec("id3edcmd " + args.join(" "), function(err, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
  });
}

function writeID3TagsOld(tdata) {
  const songBuffer = fs.readFileSync("./mp3/" + tdata.podcast_file);
  const coverBuffer = fs.readFileSync("./site/static/" + tdata.episode_image);

  const writer = new ID3Writer(songBuffer);
  writer.setFrame("TIT2", tdata.title)
    .setFrame("TPE1", tdata.hosts)
    .setFrame("TPE2", tdata.hosts[0])
    .setFrame("TCON", ["Podcast"])
    .setFrame("TALB", "Catholic Study Podcast")
    .setFrame("TRCK", tdata.podcast_file.split("-" [0]))
    .setFrame("TYER", tdata.PublishDate.getFullYear())
    .setFrame("WCOP", "© " + tdata.PublishDate.getFullYear() + " Kevin Hammer")
    .setFrame("APIC", {
      type: 3,
      data: coverBuffer,
      description: "Super picture"
    })
    .setFrame("COMM", {
      description: tdata.title,
      text: tdata.Description
    });
  writer.addTag();

  const taggedSongBuffer = Buffer.from(writer.arrayBuffer);
  fs.writeFileSync("./mp3/" + tdata.podcast_file.replace(".mp3", "") + "-tagged.mp3", taggedSongBuffer);
}

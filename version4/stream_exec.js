let fs = require("fs");

// 方法一 : 场景 => 读写中间不做控制
let targetFile = fs.createWriteStream("qianbin.js");
fs.createReadStream("./lianxi.js").pipe(targetFile);

// 方法二
let reader = fs.createReadStream("./lianxi.js");
let writer = fs.createWriteStream('qianbin2.js');
reader.on("data", (stream) => {
  writer.write(stream);
})

// createReadStream：将内容转为流
// createWriteStream：将流变为内容
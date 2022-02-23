const express = require("express");
const bodyParser = require("body-parser");
const multiparty = require("multiparty");
const fse = require("fs-extra");
const path = require("path");
const fs = require("fs");

const app = express();          // 创建express实例

app.use(express.static(__dirname + ''));      // 设置静态文件目录
app.use(bodyParser.urlencoded({extended:true}));      // 使用bodyParser解析请求体中间件
app.use(bodyParser.json());

// 服务端把所有分片放到同一个目录里（服务端应该把所有分片放到一个统一目录里）
const UPLOAD_DIR = path.resolve(__dirname, 'public/upload');

app.post('/upload', function(req, res){
  const form = new multiparty.Form({uploadDir: 'temp'});        // multiparty用来处理上传文件的，定义存储目录为temp
  form.parse(req);

  // 定义一个和文件同名的存放目录
  form.on('file', async (name, chunk)=>{
    // 存放切片的目录
    let chunkDir = `${UPLOAD_DIR}/${chunk.originalFilename.split('.')[0]}`;
    if(!fse.existsSync(chunkDir)){
      await fse.mkdirs(chunkDir);
    }

    // 原文件名.index.ext（分片按照索引编号，再次命名）
    var dPath = path.join(chunkDir, chunk.originalFilename.split('.')[1]);
    // 将分片从临时目录移动到文件同名的存放目录
    // await fse.move(chunk.path, dPath, {overwrite: true});
    res.send('文件上传成功');
  });
})

app.post('/merge', async (req, res) => {
  let name = req.body.name;
  let fname = name.split('.')[0];

  let chunkDir = path.join(UPLOAD_DIR, fname);
  let chunks = await fse.readdir(chunkDir);

  chunks.sort((a, b) => a - b).map(chunkPath => {
    // 合并文件（将合并之后的文件放在upload目录下，与同级）
    fs.appendFileSync(
      path.join(UPLOAD_DIR, name),
      fs.readFileSync(`${chunkDir}/${chunkPath}`)
    );
  });

  fse.removeSync(chunkDir);
  res.send({
    msg: '合并成功',
    url: `http://localhost:3000/upload/${name}`
  })
});

app.listen(3000, function(){
  console.log('监听3000端口')
});
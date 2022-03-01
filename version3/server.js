const fs = require("fs");
const path = require("path");
const util = require("util");
const Koa = require("koa");
const cors = require("@koa/cors");
const multer = require("@koa/multer");
const Router = require("@koa/router");
const serve = require("koa-static");
const fse = require("fs-extra");
// util.promisify的用法 https://www.geeksforgeeks.org/node-js-util-promisify-method/
const readdir = util.promisify(fs.readdir);
const unlink = util.promisify(fs.unlink);

const app = new Koa();
const router = new Router();
const TMP_DIR = path.join(__dirname, "tmp"); // 临时目录
const UPLOAD_DIR = path.join(__dirname, "/public/upload");
const IGNORES = [".DS_Store"]; // 忽略的文件列表

// multer用法：https://blog.csdn.net/qq_42778001/article/details/104442163
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    let fileMd5 = file.originalname.split("-")[0];
    const fileDir = path.join(TMP_DIR, fileMd5);
    await fse.ensureDir(fileDir);
    cb(null, fileDir);
  },
  filename: function (req, file, cb) {
    let chunkIndex = file.originalname.split("-")[1];
    cb(null, `${chunkIndex}`);
  },
});

const multerUpload = multer({ storage });

// 注册中间件
app.use(cors());
app.use(serve(UPLOAD_DIR));
app.use(router.routes()).use(router.allowedMethods());

router.get("/", async (ctx) => {
  ctx.body = "大文件并发上传示例";
});

// 判断文件是否已经存在服务器端
router.get("/upload/exists", async (ctx) => {
  const { name: fileName, md5: fileMd5 } = ctx.query;
  const filePath = path.join(UPLOAD_DIR, fileName);
  const isExists = await fse.pathExists(filePath);
  if (isExists) {
    ctx.body = {
      status: "success",
      data: {
        isExists: true,
        url: `http://localhost:3000/${fileName}`,
      },
    };
  } else {
    let chunkIds = [];
    const chunksPath = path.join(TMP_DIR, fileMd5);
    const hasChunksPath = await fse.pathExists(chunksPath);
    if (hasChunksPath) {
      let files = await readdir(chunksPath);
      chunkIds = files.filter((file) => {
        return IGNORES.indexOf(file) === -1;
      });
    }
    ctx.body = {
      status: "success",
      data: {
        isExists: false,
        chunkIds,
      },
    };
  }
});

// 接受文件片
router.post("/upload/single", multerUpload.single("file"), async (ctx, next) => {
  ctx.body = {
    code: 1,
    data: ctx.file,
  };
});

// 合并完成信号
router.get("/upload/concatFiles", async (ctx) => {
  const { name: fileName, md5: fileMd5 } = ctx.query;
  await concatFiles(
    path.join(TMP_DIR, fileMd5),
    path.join(UPLOAD_DIR, fileName)
  );
  ctx.body = {
    status: "success",
    data: {
      url: `http://localhost:3000/${fileName}`,
    },
  };
});

// 合并文件 临时目录sourceDir，目标目录targetPath
async function concatFiles(sourceDir, targetPath) {
  const readFile = (file, ws) =>
    new Promise((resolve, reject) => {
      fs.createReadStream(file)
        .on("data", (data) => ws.write(data))
        .on("end", resolve)
        .on("error", reject);
    });
  const files = await readdir(sourceDir);
  // 对临时文件中的文件上传片段进行排序
  const sortedFiles = files
    .filter((file) => {
      // 过滤掉没用文件
      return IGNORES.indexOf(file) === -1;
    })
    .sort((a, b) => a - b);
  
  // --- 写入 --- 
  const writeStream = fs.createWriteStream(targetPath);
  for (const file of sortedFiles) {
    let filePath = path.join(sourceDir, file);
    // 将 filePath 写入到 writeStream
    await readFile(filePath, writeStream);
    await unlink(filePath); // 删除已合并的分块
  }
  writeStream.end();
}

app.listen(3000, () => {
  console.log("app starting at port 3000");
});
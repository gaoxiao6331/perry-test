# Perry TypeScript Native Experiments

本仓库用于验证 [Perry](https://perry.run/) 将 TypeScript 直接编译为原生可执行文件的可行性与性能表现。

目前的测试用例：

- JSON 解析器：手写 JSONParser 对比 Node.js（带 V8 JIT）与 Perry 原生二进制[`doc/json-parse.md`](./doc/json-parse.md)。
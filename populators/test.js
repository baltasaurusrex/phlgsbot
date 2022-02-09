import xlsx from "xlsx";
import { URL } from "url";

console.log("test");
console.log("process.cwd()", process.cwd());
const __dirname = new URL(".", import.meta.url).pathname;
console.log(__dirname);

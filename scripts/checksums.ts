import path from "node:path";
import manifest from "../package.json";
import {
  releaseFileNames,
  writeReleaseChecksums,
  verifyReleaseChecksums,
} from "./release-artifacts";

const directory = path.resolve(manifest.build.directories.output);
const files = releaseFileNames(manifest.build.productName, manifest.version);
if (process.argv.includes("--verify")) {
  await verifyReleaseChecksums(directory, files);
  console.log("SHA256 checksums match both release executables.");
} else {
  await writeReleaseChecksums(directory, files);
  console.log("Generated release/SHA256SUMS.txt for both release executables.");
}

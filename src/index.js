const fs = require('fs');
const https = require('https');
const path = require('path');


if (!process.argv[2]) {
    console.error(`Error: provide package.json file path \n ex: node index.js "c:\\package.json"`);
    process.exit(0)
}

// Get the file name from the command line arguments
const filePath = process.argv[2];

const npmRegistry = `https://registry.npmjs.org/$package$/$version$`
const downloadFolder = path.join(process.argv[3], `OSS_${Date.now()}`);

if (!filePath) {
    console.error('Please provide a file path as a command line argument.');
    process.exit(1);
}

async function readPackageJSON() {
    const fileContent = [];

    fs.readFile(filePath, 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading the file:', err);
            return;
        }

        try {
            const packages = JSON.parse(data);
            console.log("package.json file read");
            const dependencies = packages.dependencies;

            if (dependencies)
                for (const key in dependencies) {
                    if (Object.hasOwnProperty.call(dependencies, key)) {
                        const version = isNaN(+dependencies[key].charAt(0)) ? dependencies[key].slice(1) : dependencies[key];
                        const metaUrl = npmRegistry.replace('$package$', key).replace('$version$', version);
                        const metaData = await readPackageMeta(key, version);
                        if (metaData) {
                            const tarball = metaData.dist.tarball;
                            console.log(`Package: ${key}: ${version} - ${metaUrl} - ${tarball}`);
                            await downalodTarball(key, metaData.version, tarball);
                            fileContent.push({
                                package: key,
                                version: version,
                                source: tarball,
                                meta: metaUrl,
                                license: metaData.license || '',
                                homepage: metaData.homepage || ''
                            })
                        } else {
                            console.error(`Unable to download meta for ${key}:${version}`)
                        }
                    }
                }

            var packagesFile = fs.createWriteStream(`${downloadFolder}/oss-packages.csv`, {
                flags: 'w' // 'a' means appending (old data will be preserved)
            });
            if (fileContent.length) {
                const keys = Object.keys(fileContent[0]).sort();
                packagesFile.write(`${keys.join(', ')} \n`);

                fileContent.forEach(item => {
                    let str = '';
                    keys.forEach((key) => str += `${item[key]},`)
                    packagesFile.write(`${str}\n`);
                })

            }

            packagesFile.close();
            // You can now work with the parsed JSON data
        } catch (parseError) {
            console.error('Error parsing the package.json', parseError);
        }
    });

}

function readPackageMeta(packageName, version) {
    return new Promise((resolve, reject) => {
        const url = npmRegistry.replace('$package$', packageName).replace('$version$', version);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                console.error(`Error: Unable to download metadata for the package ${packageName}:${version} and Received status code ${response.statusCode}`);
                resolve();
            }

            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                return resolve(JSON.parse(data));
            });
        }).on('error', (err) => {
            console.error(`Error downloading metadata for the package ${packageName}:${version} content:`, err);
            resolve();
        });

    });
}

function downalodTarball(package, version, tarballUrl) {
    if (!fs.existsSync(downloadFolder)) {
        fs.mkdirSync(downloadFolder, { recursive: true });
    }
    console.log(`Downloading ${tarballUrl} ...`)
    const outputFile = `${downloadFolder}/${package.replace('/','_')}-${version}.tgz`

    return new Promise((resolve, reject) => {

        const fileStream = fs.createWriteStream(outputFile);

        https.get(tarballUrl, (response) => {
            if (response.statusCode !== 200) {
                console.error(`Error: Received status code to downalod ${tarballUrl} ${response.statusCode}`);
                reject();
            }

            response.pipe(fileStream);

            fileStream.on('finish', () => {
                console.log(`File downloaded and saved as ${outputFile}`);
                fileStream.close();
                resolve();
            });
        }).on('error', (err) => {
            console.error(`Error downloading file  ${tarballUrl}: ${err}`);
            reject();
        });
    });
}



readPackageJSON();
# mongograte

[![License: MIT](https://img.shields.io/github/license/un0tec/mongograte?color=orange)](LICENSE)
[![Release](https://img.shields.io/github/v/release/un0tec/mongograte?color=green&label=Release)](https://github.com/un0tec/mongograte/releases/latest)


## README Content
1. :notebook_with_decorative_cover: [Description](#-description)
2. :warning: [Before running](#-before-running)
3. :writing_hand: [Syntax](#-syntax)
4. :hammer: [Usage](#-usage)
5. :bookmark_tabs: [Options](#-options)
6. :monocle_face: [Preview](#-preview)
7. :page_with_curl: [License](#-license)
8. :heart: [Contribution](#-contributing)

## # Description

Tool for migrating MongoDB to MongoDB

## # Before Running

Download and place the script in the desired path. Then assign execute permissions to the script with the following command:

    sudo chmod +x ./mongograte

If you want to  run the script from anywhere on the system, place the file in `/usr/local/bin` directory or add the folder where it is to the `$PATH` system variable.

## # Syntax

    mongograte [OPTIONS]

## # Usage

    mongograte [OPTIONS]

You can see default values in [options](#-options) section

## # Options

You can use the following options:

| Option | Description | Type | Required  | Default value |
|-----------------|---------------------------------------------------------------|---------------|------------|----------------|
| `-d`, `--databases` | Target databases | array | Yes | |
| `-s`, `--source` | Source server uri | string | Yes | |
| `-t`, `--target` | Target server uri | string | Yes | |
| `-c`, `--clear` | Drop collections in the target database | boolean | No | "false" |
| `-l`, `--limit`    | Limit of records to be migrated | number | No | 1000 |
| `-i`, `--insecure` | Allow use remote database as the target database | boolean | No | false |
| `--timeout` | Allows increasing the default timeout (ms) | number | No | 5000 |
| `--listen` | Listen changes in target databases\|collections | string | No | |
| `-v`, `--version` | Show version number | boolean | No | |
| `-h`, `--help` | Show help | boolean | No | |

## # Preview

--

## # License

Distributed under the MIT License. See `LICENSE` for more information.

## # Contributing

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

:star: Feel free to contribute :star:
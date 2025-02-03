# mongograte

[![License: MIT](https://img.shields.io/github/license/un0tec/mongograte?color=orange&cache=none)](LICENSE)
[![Release](https://img.shields.io/github/v/release/un0tec/mongograte?color=green&label=Release)](https://github.com/un0tec/mongograte/releases/latest)

A robust tool for seamless migration of data between MongoDB databases, allowing for efficient synchronization, with support for listening to live changes in the source database.

1. :notebook_with_decorative_cover: [Description](#-description)
2. :warning: [Before running](#-before-running)
3. :writing_hand: [Syntax](#-syntax)
4. :hammer: [Usage](#-usage)
5. :bookmark_tabs: [Options](#-options)
6. :monocle_face: [Examples](#-examples)
7. :page_with_curl: [License](#-license)
8. :heart: [Contribution](#-contributing)

## # Description

`mongograte` is a command-line tool designed to facilitate the migration of MongoDB collections and databases from a source server to a target server. It supports options for clearing existing data, limiting the number of documents to migrate, and listening to changes for real-time synchronization.

## # Before Running

Download and place the script in the desired path. For Linux, to make the script executable, you should assign the appropriate permissions:

    sudo chmod +x ./mongograte

For convenience, you may want to move the script to `/usr/local/bin` or add its directory to your system's `$PATH` variable to run it from anywhere.

## # Syntax

The general syntax for using `mongograte` is:

    mongograte [OPTIONS]

## # Usage

Basic usage example:

    mongograte -d myDatabases -s mongodb://host:port -t mongodb://host:port

You can see default values in [options](#-options) section

## # Options

The following command-line options are supported:

| Option | Description | Type | Required  | Default value |
|-----------------|---------------------------------------------------------------|---------------|------------|----------------|
| `-d`, `--databases` | List of target databases to migrate | array | Yes | - |
| `-s`, `--source` | Source MongoDB server URI | string | Yes | - |
| `-t`, `--target` | Target MongoDB server URI | string | Yes | - |
| `--migrate-collections` | Collections to migrate from the source database | string | No | - |
| `--ignore-collections` | Collections to exclude from the migration process | string | No | - |
| `--drop` | Drop target collections in the target database before migration | boolean | No | false |
| `--drop-all` | Drop all collections in the target database before migration | boolean | No | false |
| `--truncate` | Truncate target collections in the target database before migration | boolean | No | true |
| `-l`, `--limit`    | Maximum number of records to migrate per collection | number | No | 1000 |
| `--query-limit`    | Maximum number of records per query | number | No | 1000 |
| `--timeout` | Timeout for MongoDB connection (ms) | number | No | 5000 |
| `--listen` | Enable real-time synchronization of source database changes | boolean | No | false |
| `-i`, `--insecure` | Allow using a remote database as the target | boolean | No | false |
| `--skip-update` | Skip checking for updates | boolean | No | false |
| `-v`, `--version` | Show version number | boolean | No | - |
| `-h`, `--help` | Display help information | boolean | No | - |

## # Examples

**Migrating a Database with Specific Options**

To migrate the testDB from a local server to a remote server with the collection drop option enabled and a limit of 500 records, use:

    mongograte -d testDB -s mongodb://localhost:port -t mongodb://remotehost:port --drop -l 500

**Real-Time Synchronization**

To listen for changes in the source database and apply them to the target, use the --listen flag:

    mongograte -d myDatabase -s mongodb://host:port -t mongodb://host:port --listen
This will keep your target database in sync with the source in near real-time.

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
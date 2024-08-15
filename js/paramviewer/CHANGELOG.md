# @gradio/paramviewer

## 0.4.21-beta.0

### Features

- [#9118](https://github.com/gradio-app/gradio/pull/9118) [`e1c404d`](https://github.com/gradio-app/gradio/commit/e1c404da1143fb52b659d03e028bdba1badf443d) - setup npm-previews of all packages.  Thanks @pngwn!

### Dependency updates

- @gradio/statustracker@0.8.0-beta.0
- @gradio/atoms@0.7.10-beta.0
- @gradio/utils@0.5.3-beta.0

## 0.4.20

### Dependency updates

- @gradio/atoms@0.7.9
- @gradio/statustracker@0.7.4

## 0.4.19

### Dependency updates

- @gradio/atoms@0.7.8
- @gradio/utils@0.5.2
- @gradio/statustracker@0.7.3

## 0.4.18

### Features

- [#8618](https://github.com/gradio-app/gradio/pull/8618) [`aa4b7a7`](https://github.com/gradio-app/gradio/commit/aa4b7a71921fd5b7ad7e3c0cce7687a8f6d284da) - Improve styling of parameter tables in the docs.  Thanks @abidlabs!

### Dependency updates

- @gradio/statustracker@0.7.2
- @gradio/atoms@0.7.7

## 0.4.17

### Features

- [#8744](https://github.com/gradio-app/gradio/pull/8744) [`b736c8d`](https://github.com/gradio-app/gradio/commit/b736c8db343087a4854f659b92732c8859fa999a) - Refactor `gr.ParamViewer` to use HTML `<details>` and other tweaks.  Thanks @abidlabs!

### Dependency updates

- @gradio/atoms@0.7.6
- @gradio/utils@0.5.1
- @gradio/statustracker@0.7.1

## 0.4.16

### Dependency updates

- @gradio/atoms@0.7.5
- @gradio/utils@0.5.0
- @gradio/statustracker@0.7.0

## 0.4.15

### Dependency updates

- @gradio/statustracker@0.6.0

## 0.4.15

### Dependency updates

- @gradio/statustracker@0.6.0

## 0.4.14

### Dependency updates

- @gradio/utils@0.4.2
- @gradio/atoms@0.7.4
- @gradio/statustracker@0.5.5

## 0.4.13

### Dependency updates

- @gradio/statustracker@0.5.4

## 0.4.12

### Dependency updates

- @gradio/statustracker@0.5.3

## 0.4.11

### Dependency updates

- @gradio/atoms@0.7.3
- @gradio/statustracker@0.5.2

## 0.4.10

### Dependency updates

- @gradio/atoms@0.7.2
- @gradio/utils@0.4.1
- @gradio/statustracker@0.5.1

## 0.4.9

### Fixes

- [#8066](https://github.com/gradio-app/gradio/pull/8066) [`624f9b9`](https://github.com/gradio-app/gradio/commit/624f9b9477f74a581a6c14119234f9efdfcda398) - make gradio dev tools a local dependency rather than bundling.  Thanks @pngwn!

### Dependency updates

- @gradio/atoms@0.7.1
- @gradio/statustracker@0.5.0
- @gradio/utils@0.4.0

## 0.4.8

### Dependency updates

- @gradio/utils@0.3.2
- @gradio/statustracker@0.4.12
- @gradio/atoms@0.7.0

## 0.4.7

### Dependency updates

- @gradio/utils@0.3.1
- @gradio/atoms@0.6.2
- @gradio/statustracker@0.4.11

## 0.4.6

### Dependency updates

- @gradio/atoms@0.6.1
- @gradio/statustracker@0.4.10

## 0.4.5

### Dependency updates

- @gradio/statustracker@0.4.9
- @gradio/atoms@0.6.0

## 0.4.4

### Patch Changes

- Updated dependencies [[`98a2719`](https://github.com/gradio-app/gradio/commit/98a2719bfb9c64338caf9009891b6c6b0b33ea89)]:
  - @gradio/statustracker@0.4.8

## 0.4.3

### Patch Changes

- Updated dependencies []:
  - @gradio/atoms@0.5.3
  - @gradio/statustracker@0.4.7

## 0.4.2

### Patch Changes

- Updated dependencies [[`065c5b1`](https://github.com/gradio-app/gradio/commit/065c5b163c4badb9d9cbd06d627fb4ba086003e7)]:
  - @gradio/utils@0.3.0
  - @gradio/atoms@0.5.2
  - @gradio/statustracker@0.4.6

## 0.4.1

### Patch Changes

- Updated dependencies [[`fdd1521`](https://github.com/gradio-app/gradio/commit/fdd15213c24b9cbc58bbc1b6beb4af7c18f48557)]:
  - @gradio/utils@0.2.2
  - @gradio/atoms@0.5.1
  - @gradio/statustracker@0.4.5

## 0.4.0

### Features

- [#7109](https://github.com/gradio-app/gradio/pull/7109) [`125a832`](https://github.com/gradio-app/gradio/commit/125a832ab7ee2b5affa574e8b32c88f430cc6663) - generate docs when running `gradio cc build`. Thanks [@pngwn](https://github.com/pngwn)!

### Fixes

- [#7130](https://github.com/gradio-app/gradio/pull/7130) [`e7ab406`](https://github.com/gradio-app/gradio/commit/e7ab4063eb2624820b9f1076960e9596791d9427) - Fix ParamViewer css. Thanks [@freddyaboulton](https://github.com/freddyaboulton)!

## 0.3.0

### Highlights

#### Custom component documentation generator ([#7030](https://github.com/gradio-app/gradio/pull/7030) [`3a944ed`](https://github.com/gradio-app/gradio/commit/3a944ed9f162a224d26959a9c556346a9d205311))

If your custom component has type hints and docstrings for both parameters and return values, you can now automatically generate a documentation page and README.md with no additional effort. Simply run the following command:

```sh
gradio cc docs
```

This will generate a Gradio app that you can upload to spaces providing rich documentation for potential users. The documentation page includes:

- Installation instructions.
- A live embedded demo and working code snippet, pulled from your demo app.
- An API reference for initialising the component, with types, default values and descriptions.
- An explanation of how the component affects the user's predict function inputs and outputs.
- Any additional interfaces or classes that are necessary to understand the API reference.
- Optional links to GitHub, PyPi, and Hugging Face Spaces.

A README will also be generated detailing the same information but in a format that is optimised for viewing on GitHub or PyPi!

Thanks [@pngwn](https://github.com/pngwn)!

### Features

- [#7069](https://github.com/gradio-app/gradio/pull/7069) [`07d520c`](https://github.com/gradio-app/gradio/commit/07d520c7a2590eb5544bd0b17f82ea31ecf43e00) - fix versions. Thanks [@pngwn](https://github.com/pngwn)!
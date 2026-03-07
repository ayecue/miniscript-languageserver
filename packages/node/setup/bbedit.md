# BBEdit Setup

BBEdit supports language servers natively. This guide walks through setting up `miniscript-languageserver` with MiniScript syntax highlighting.

## Prerequisites

Install the language server globally and make sure the npm global bin directory is on your PATH:

```bash
npm install -g miniscript-languageserver
```

Add the following to your `~/.bashrc` or `~/.zshrc`:

```bash
export PATH=~/.npm-global/bin:$PATH
```

## Required Files

You need two files: a language module plist and an LSP configuration JSON.

### miniscript.plist

Save the following as `miniscript.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>BBEditDocumentType</key>
    <string>CodelessLanguageModule</string>
    <key>BBLMLanguageDisplayName</key>
    <string>MiniScript</string>
    <key>BBLMLanguageCode</key>
    <string>MNSC</string>
    <key>BBLMLanguageID</key>
    <string>miniscript</string>

    <key>BBLMSuffixMap</key>
    <array>
        <dict>
            <key>BBLMLanguageSuffix</key>
            <string>.ms</string>
        </dict>
    </array>

    <key>BBLMColorsSyntax</key>
    <true/>
    <key>BBLMUsesLSPSemanticTokensForColoring</key>
    <true/>
    <key>BBLMSupportsLSP</key>
    <true/>
    <key>BBLMIsCaseInsensitive</key>
    <true/>

    <key>Language Features</key>
    <dict>
        <key>Identifier and Keyword Character Class</key>
        <string>a-zA-Z0-9_</string>
        <key>Comment Pattern</key>
        <string>(\/\/.*$)|(\/\*[\s\S]*?\*\/)</string>
        <key>String Pattern</key>
        <string>".*?"</string>
        <key>Open Block Comments</key>
        <string>/*</string>
        <key>Close Block Comments</key>
        <string>*/</string>
        <key>Open Line Comments</key>
        <string>//</string>
        <key>Open Strings 1</key>
        <string>"</string>
        <key>Close Strings 1</key>
        <string>"</string>
        <key>Escape Char in Strings 1</key>
        <string>""</string>
        <key>End-of-line Ends Strings 1</key>
        <false/>
        <key>Open Parameter Lists</key>
        <string>(</string>
        <key>Close Parameter Lists</key>
        <string>)</string>
        <key>Prefix for Functions</key>
        <string>function</string>
    </dict>

    <key>BBLMKeywordList</key>
    <array>
        <string>if</string>
        <string>then</string>
        <string>else</string>
        <string>end</string>
        <string>while</string>
        <string>for</string>
        <string>from</string>
        <string>in</string>
        <string>function</string>
        <string>return</string>
        <string>break</string>
        <string>continue</string>
        <string>repeat</string>
        <string>and</string>
        <string>or</string>
        <string>not</string>
        <string>isa</string>
        <string>new</string>
        <string>true</string>
        <string>false</string>
        <string>null</string>
        <string>self</string>
        <string>super</string>
        <string>locals</string>
        <string>globals</string>
        <string>outer</string>
        <string>params</string>
        <string>list</string>
        <string>map</string>
        <string>number</string>
        <string>string</string>
        <string>funcRef</string>
    </array>

    <key>BBLMPredefinedNameList</key>
    <array>
        <string>print</string>
        <string>hasIndex</string>
        <string>typeof</string>
        <string>indexes</string>
        <string>values</string>
        <string>indexOf</string>
        <string>len</string>
        <string>shuffle</string>
        <string>val</string>
        <string>lower</string>
        <string>upper</string>
        <string>sum</string>
        <string>pop</string>
        <string>pull</string>
        <string>push</string>
        <string>sort</string>
        <string>remove</string>
        <string>wait</string>
        <string>abs</string>
        <string>acos</string>
        <string>asin</string>
        <string>atan</string>
        <string>tan</string>
        <string>cos</string>
        <string>code</string>
        <string>char</string>
        <string>sin</string>
        <string>floor</string>
        <string>range</string>
        <string>round</string>
        <string>rnd</string>
        <string>sign</string>
        <string>sqrt</string>
        <string>str</string>
        <string>ceil</string>
        <string>pi</string>
        <string>slice</string>
        <string>hash</string>
        <string>time</string>
        <string>bitAnd</string>
        <string>bitOr</string>
        <string>bitXor</string>
        <string>log</string>
        <string>yield</string>
        <string>insert</string>
        <string>to_int</string>
        <string>join</string>
        <string>split</string>
        <string>reverse</string>
        <string>replace</string>
        <string>trim</string>
        <string>lastIndexOf</string>
        <string>user_input</string>
        <string>exit</string>
    </array>

    <key>BBLMLanguageServerInfo</key>
    <dict>
        <key>ServerCommand</key>
        <string>miniscript-languageserver</string>
        <key>ServerArguments</key>
        <array>
            <string>--stdio</string>
        </array>
        <key>ServerLanguageID</key>
        <string>miniscript</string>
    </dict>
</dict>
</plist>
```

### miniscript.json

Save the following as `miniscript.json`:

```json
{
    "initializationOptions": {
      "miniscript": {}
    },
    "workspaceConfigurations": {
      "*": {
        "miniscript": {
          "fileExtensions": "ms",
          "formatter": true,
          "autocomplete": true,
          "hoverdocs": true,
          "diagnostic": true,
          "transpiler": {
              "beautify": {
                  "keepParentheses": true,
                  "indentation": "Tab",
                  "indentationSpaces": 2
              }
          },
          "typeAnalyzer": {
              "strategy": "Workspace"
          }
        }
      }
    }
}
```

## Steps

1. Copy `miniscript.plist` into:

   ```
   ~/Library/Application Support/BBEdit/Language Modules/
   ```

2. Copy `miniscript.json` into:

   ```
   ~/Library/Application Support/BBEdit/Language Servers/Configuration/
   ```

3. Open BBEdit and go to **BBEdit > Settings > Application** and enable **Allow sandbox access**.

4. Go to **BBEdit > Settings > Languages > Custom Settings**, click the **+** button, and select **MiniScript**. In the **Server** tab, confirm the LSP is enabled. The server settings should already be populated from the plist file. Change the configuration from **default** to **miniscript**.

5. Restart BBEdit.

## Notes

The language server should now be active for `.ms` files. Unfortunately BBEdit does not support semantic highlighting via the LSP. Semantic token colors can only be defined through the plist file itself.

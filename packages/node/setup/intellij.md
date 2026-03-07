# IntelliJ Setup

1. [Install miniscript-languageserver](../README.md#install).
2. Install the `LSP4IJ` plugin from the JetBrains Plugin Marketplace.
3. Go to **Languages & Frameworks > Language Servers**.
4. Click the "+" icon to add a new language server configuration.
5. In the **Name** field, enter `miniscript`.
6. In the **Command** field, enter `miniscript-languageserver --stdio`.
7. In the **Filename Patterns** section:
   - Set **File Name Pattern** to `*.src`.
   - Set **Language Id** to `miniscript`.
8. Restart IntelliJ.

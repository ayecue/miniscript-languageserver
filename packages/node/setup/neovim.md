# Neovim Setup

Add the following configuration to your `init.vim`:

```vim
" Install vim-plug if it's not already installed
call plug#begin('~/.vim/plugged')

" Install LSP config plugin
Plug 'neovim/nvim-lspconfig'

call plug#end()

" LSP configuration for miniscript-languageserver
lua <<EOF
  local configs = require'lspconfig.configs'
  local lspconfig = require'lspconfig'

  -- Enable debug-level logging
  vim.lsp.set_log_level("debug")

  if not configs.miniscript then
    configs.miniscript = {
      default_config = {
        cmd = { "miniscript-languageserver", "--stdio" },
        filetypes = { "miniscript" },
        root_dir = lspconfig.util.root_pattern(".git", vim.fn.getcwd()),
        settings = {},
        on_attach = function(client, bufnr)
          vim.api.nvim_buf_set_keymap(bufnr, 'n', 'K', '<cmd>lua vim.lsp.buf.hover()<CR>', { noremap = true, silent = true })
        end,
      },
    }
  end

  -- Register and start the miniscript LSP
  lspconfig.miniscript.setup{}
EOF

autocmd BufRead,BufNewFile *.src set filetype=miniscript
```

Run `:PlugInstall` to install the necessary plugins.

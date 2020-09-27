import * as vscode from "vscode";
import {
  getLanguageService,
  Node,
  TextDocument as HtmlTextDocument,
} from "vscode-html-languageservice";

const htmlService = getLanguageService();

function makeVscTextDocument(htmlDocument: HtmlTextDocument): HtmlTextDocument {
  return HtmlTextDocument.create(
    "untitled://embedded.html",
    "html",
    1,
    htmlDocument.getText()
  );
}

function makeVscHtmlDocument(vscTextDocument: HtmlTextDocument) {
  return htmlService.parseHTMLDocument(vscTextDocument);
}

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private codeLenses: vscode.CodeLens[] = [];
  private nodeAttributesByLineAndCharacter: any = {};
  private regex: RegExp;
  private _onDidChangeCodeLenses: vscode.EventEmitter<
    void
  > = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor() {
    this.regex = /(.+)/g;

    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const baseHtmlDocument = {
      ...document,
      uri: document.uri.toString(),
    } as HtmlTextDocument;

    // htmlDocument.

    if (
      vscode.workspace
        .getConfiguration("html-biscuits")
        .get("enableCodeLens", true)
    ) {
      this.codeLenses = [];
      this.nodeAttributesByLineAndCharacter = {};
      const parsedDocument = htmlService.parseHTMLDocument(baseHtmlDocument);

      let nodes: Node[] = parsedDocument.roots;
      let children: Node[] = [];
      while (nodes.length !== 0) {
        console.log("nodes", nodes);
        nodes.forEach((node) => {
          if (node.children.length) {
            console.log("adding children", node.children);
            children = [...children, ...node.children];
          }

          if (node.attributes && node.tag) {
            console.log("has attributes and tag");
            if (node.endTagStart) {
              console.log("has endTagStart");
              const line = document.lineAt(
                document.positionAt(node.endTagStart)
              );
              // TODO: see if we can get index a better way
              const indexOf = line.text.indexOf(`</${node.tag}`);

              const position = new vscode.Position(line.lineNumber, indexOf);

              const range = document.getWordRangeAtPosition(
                position,
                new RegExp(`</${node.tag}`)
              );

              const previousNodeAttributes = parsedDocument?.findNodeAt(
                node.endTagStart
              )?.attributes;

              console.log("range", range);
              console.log("previousNodeAttributes", previousNodeAttributes);

              if (range && previousNodeAttributes) {
                this.codeLenses.push(new vscode.CodeLens(range));

                const { line, character } = range.start;

                if (!this.nodeAttributesByLineAndCharacter[line]) {
                  this.nodeAttributesByLineAndCharacter[line] = {};
                }

                this.nodeAttributesByLineAndCharacter[line][
                  character
                ] = previousNodeAttributes;
              }
            }
          }
        });

        nodes = children;
        children = [];
      }

      return this.codeLenses;
    }
    return [];
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ) {
    if (
      vscode.workspace
        .getConfiguration("html-biscuits")
        .get("enableCodeLens", true)
    ) {
      const { line, character } = codeLens.range.start;

      const attributes = this.nodeAttributesByLineAndCharacter[line][character];

      codeLens.command = {
        title: JSON.stringify(attributes),
        tooltip: "Tooltip provided by sample extension",
        command: "html-biscuits.codelensAction",
        arguments: ["Argument 1", false],
      };
      return codeLens;
    }
    return null;
  }
}

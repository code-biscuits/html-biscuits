import { mainModule } from "process";
import * as vscode from "vscode";
import {
  getLanguageService,
  Node,
  TextDocument as HtmlTextDocument,
} from "vscode-html-languageservice";

const htmlService = getLanguageService();
const decorationType = vscode.window.createTextEditorDecorationType({
  after: {
    color: new vscode.ThemeColor("editorLineNumber.foreground"), // new vscode.ThemeColor("dart.closingLabels"),
    margin: "2px",
  },
  rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
});

export function activate(context: vscode.ExtensionContext) {
  let decorations: vscode.DecorationOptions[] = [];
  let activeEditor = vscode.window.activeTextEditor;

  // htmlDocument.
  function updateDecorations() {
    decorations = [];
    activeEditor = vscode.window.activeTextEditor;
    const document = activeEditor?.document;
    console.log("firing update");
    if (document) {
      const baseHtmlDocument = {
        ...document,
        uri: document?.uri.toString(),
      } as HtmlTextDocument;
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

              const nodeAttributes = parsedDocument?.findNodeAt(
                node.endTagStart
              )?.attributes;

              console.log("range", range);
              console.log("nodeAttributes", nodeAttributes);

              if (range && nodeAttributes && activeEditor) {
                const { line, character } = range.start;

                const endOfLine = activeEditor.document.lineAt(line).range.end;

                const stringifiedAttributes = stringifyAttributes(
                  nodeAttributes
                );

                if (stringifiedAttributes) {
                  decorations.push({
                    range: new vscode.Range(
                      activeEditor.document.positionAt(indexOf),
                      endOfLine
                    ),
                    renderOptions: {
                      after: {
                        contentText: stringifiedAttributes,
                      },
                    },
                  });
                }
              }
            }
          }
        });

        nodes = children;
        children = [];
      }

      if (activeEditor) {
        activeEditor?.setDecorations(decorationType, decorations);
      }
    }
  }

  if (activeEditor) {
    updateDecorations();
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      if (editor) {
        updateDecorations();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        updateDecorations();
      }
    },
    null,
    context.subscriptions
  );
}

function stringifyAttributes(attributes: any) {
  const prefix = " // ";
  let stringifiedAttributes = prefix;
  if (attributes.id) {
    stringifiedAttributes += `#${attributes.id}`.replace('"', "");
  }
  if (attributes.class) {
    stringifiedAttributes +=
      " " +
      attributes.class
        .split(" ")
        .map((className: string) => {
          return `.${className}`.replace('"', "");
        })
        .join(" ")
        .replace('"', "");
  }
  if (attributes.className) {
    stringifiedAttributes +=
      " " +
      attributes.className
        .split(" ")
        .map((className: string) => {
          return `.${className}`.replace('"', "");
        })
        .join(" ")
        .replace('"', "");
  }
  stringifiedAttributes = stringifiedAttributes.replace('"', "");
  if (stringifiedAttributes !== prefix) {
    return stringifiedAttributes;
  }
  return "";
}

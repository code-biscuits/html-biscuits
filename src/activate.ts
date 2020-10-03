import * as vscode from "vscode";
import {
  getLanguageService,
  Node,
  TextDocument as HtmlTextDocument,
} from "vscode-html-languageservice";

const CONFIG_PREFIX_KEY = "html-biscuits.annotationPrefix";
const CONFIG_COLOR_KEY = "html-biscuits.annotationColor";
const CONFIG_DISTANCE_KEY = "html-biscuits.annotationMinDistance";

const htmlService = getLanguageService();

let updateInterval: NodeJS.Timeout | null;

export function activate(context: vscode.ExtensionContext) {
  let decorations: vscode.DecorationOptions[] = [];
  let activeEditor = vscode.window.activeTextEditor;

  const decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      color:
        vscode.workspace.getConfiguration().get(CONFIG_COLOR_KEY) ||
        new vscode.ThemeColor("editorLineNumber.foreground"),
      margin: "2px",
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
  });

  function updateDecorations() {
    decorations = [];

    activeEditor = vscode.window.activeTextEditor;
    const document = activeEditor?.document;
    const prefix: string =
      vscode.workspace.getConfiguration().get(CONFIG_PREFIX_KEY) || "// ";
    const minDistance: number =
      vscode.workspace.getConfiguration().get(CONFIG_DISTANCE_KEY) || 0;
    if (document) {
      const baseHtmlDocument = {
        ...document,
        uri: document?.uri.toString(),
      } as HtmlTextDocument;
      const parsedDocument = htmlService.parseHTMLDocument(baseHtmlDocument);

      let nodes: Node[] = parsedDocument.roots;
      let children: Node[] = [];
      while (nodes.length !== 0) {
        nodes.forEach((node) => {
          if (node.children.length) {
            children = [...children, ...node.children];
          }

          if (node.attributes && node.tag) {
            if (node.endTagStart) {
              const startLine = document.lineAt(
                document.positionAt(node.startTagEnd || node.endTagStart)
              );
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

              if (
                range &&
                nodeAttributes &&
                activeEditor &&
                line.lineNumber - startLine.lineNumber >= minDistance
              ) {
                const { line, character } = range.start;

                const endOfLine = activeEditor.document.lineAt(line).range.end;

                const stringifiedAttributes = stringifyAttributes(
                  nodeAttributes,
                  prefix
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
    }

    if (activeEditor) {
      activeEditor?.setDecorations(decorationType, decorations);
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

function stringifyAttributes(attributes: any, prefix: string) {
  let stringifiedAttributes = prefix;
  if (attributes.id) {
    stringifiedAttributes += `#${attributes.id}`.replace('"', "");
  }
  if (attributes.class) {
    stringifiedAttributes = addDecoratedClassNamesWithDot(
      stringifiedAttributes,
      attributes.class
    );
  }
  if (attributes.className) {
    stringifiedAttributes = addDecoratedClassNamesWithDot(
      stringifiedAttributes,
      attributes.className
    );
  }
  stringifiedAttributes = stringifiedAttributes.replace('"', "");
  if (stringifiedAttributes !== prefix) {
    return stringifiedAttributes;
  }
  return "";
}

function addDecoratedClassNamesWithDot(
  originalString: string,
  classNames: string
) {
  return (originalString +=
    " " +
    classNames
      .split(" ")
      .map((className: string) => {
        return `.${className}`.replace('"', "");
      })
      .join(" ")
      .replace('"', ""));
}

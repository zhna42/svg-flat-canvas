module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Запрещает ИИ трогать DOM API вне файла рендеринга. Слушатели разрешены только на корне и window.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();

    if (
      filename.includes("Renderer") ||
      filename.includes("renderLoop") ||
      filename.includes("/renderer/") ||
      filename.includes("EventManager") ||
      filename.includes("SelectionOverlay")
    ) {
      return {};
    }

    const bannedGlobals = ["document", "HTMLElement", "SVGElement"];

    const bannedMethods = [
      "getElementById",
      "querySelector",
      "querySelectorAll",
      "getElementsByClassName",
      "getElementsByTagName",
      "createElement",
      "createElementNS",
      "remove",
    ];

    const allowedEventTargets = ["window", "rootSvg", "svgCanvas", "canvasElement"];

    return {
      Identifier(node) {
        if (bannedGlobals.includes(node.name)) {
          if (!node.parent || node.parent.type !== "VariableDeclarator") {
            context.report({
              node,
              message: `Запрещено использовать DOM API (${node.name}) вне рендерера!`,
            });
          }
        }
      },

      MemberExpression(node) {
        if (!node.property || node.property.type !== "Identifier") return;

        const propertyName = node.property.name;

        if (bannedMethods.includes(propertyName)) {
          context.report({
            node: node.property,
            message: `Запрещен вызов метода DOM API (.${propertyName}) вне рендерера!`,
          });
          return;
        }

        if (propertyName === "addEventListener" || propertyName === "removeEventListener") {
          let objectName = "";

          if (node.object.type === "Identifier") {
            objectName = node.object.name;
          } else if (node.object.type === "MemberExpression" && node.object.property.type === "Identifier") {
            objectName = node.object.property.name;
          }

          if (!allowedEventTargets.includes(objectName)) {
            context.report({
              node: node.property,
              message: `Слушатели событий можно вешать ТОЛЬКО на window или корень (${allowedEventTargets.join(", ")}). На объект "${objectName || "unknown"}" вешать нельзя!`,
            });
          }
        }
      },
    };
  },
};

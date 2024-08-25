const PageNamesList = ({
  matchArray,
  elementsSelectionnes,
  setElementsSelectionnes,
}) => {
  const toutSelectionne = elementsSelectionnes.length === matchArray.length;

  const gererChangementElement = (element) => {
    setElementsSelectionnes((prev) =>
      prev.includes(element)
        ? prev.filter((e) => e !== element)
        : [...prev, element]
    );
  };

  const gererChangementTout = () => {
    setElementsSelectionnes(toutSelectionne ? [] : [...matchArray]);
  };

  return (
    <div>
      <div className="mb-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={toutSelectionne}
            onChange={gererChangementTout}
            className="mr-2"
          />
          Tout sélectionner
        </label>
      </div>
      <ul>
        {matchArray.map((match) => (
          <li>
            <input
              type="checkbox"
              checked={elementsSelectionnes.includes(match)}
              onChange={() => gererChangementElement(match)}
              className="mr-2"
            />
            {"[[" +
              match.title +
              "]] => [[" +
              replaceSubstringOrCaptureGroup(match.title, find, replace) +
              "]]"}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PageNamesList;

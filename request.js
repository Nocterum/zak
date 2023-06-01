const ky = request('ky');

const json = await ky.post('https://opusdeco.ru/', {json: {foo: true}}).json();

module.exports = json;